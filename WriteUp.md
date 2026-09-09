# Write-up

## 1. What did you build for Part B, and why that?

Logging visits and seeing what they cost.

The app is called Feeding Brennen, the README says it tracks spending, and
there's nowhere in it that mentions money. Meanwhile `visits` is sitting in the
schema, seeded, with nothing touching it — no route, no page. The app had a hole
exactly the shape of its own description.

I ruled out wiring forms onto the A2 endpoints. Quicker, and it would have made
Part A visible, but it only finishes A rather than making the app a spend
tracker.

## 2. What did you decide, and what did you rule out?

Visits nest under a restaurant for listing and creating, because a visit means
nothing on its own. Deleting is flat at `/api/visits/:id` — you already have the
id there, and nesting would add a restaurant id that can disagree with it.

Posting a visit to a restaurant that doesn't exist returns 404, not the 409 the
foreign key would have given me.

I ruled out editing a visit, and I didn't add a unique constraint on restaurant
names even though the brief mentions duplicates — chains exist.

Least sure: I reject future dates. This logs money already spent, so a future
visit would skew the totals. But someone logging a dinner they've already booked
would find that annoying.

## 3. Where did you cut corners?

No tests. There's no test setup in the repo, so I spent the time covering edge
cases by hand — my verification is curl commands rather than something that runs.

The form doesn't validate client-side; it posts and renders whatever the 400
says. Deliberate, so the rules live in one place, but you get errors after a
round trip rather than as you type.

The homepage makes two calls and merges them. They go out together so it's one
round trip, but it's still awkward.

With another day: tests, then editing a visit.

## 4. What should you look at first?

`lib/errors.ts` and `lib/validation.ts` — that's where most of the thinking went
and every route is thin on top of them. Then `app/api/spending/route.ts`, the
smallest file that explains why I built any of this.

---

## Part B: routes

| Method and path                     | What it does                          | Success            | Errors                                                    |
| ----------------------------------- | ------------------------------------- | ------------------ | --------------------------------------------------------- |
| `GET /api/restaurants/:id/visits`   | That restaurant's visits, newest first | `200` + array      | `404` if the restaurant doesn't exist or `:id` isn't valid |
| `POST /api/restaurants/:id/visits`  | Log a visit                            | `201` + the visit  | `400` bad body, `404` restaurant missing                   |
| `DELETE /api/visits/:id`            | Remove a visit                         | `204`, no body     | `404` if it doesn't exist                                  |
| `GET /api/spending`                 | Totals per restaurant and overall      | `200` + summary    | —                                                          |

**`POST /api/restaurants/:id/visits`**

```jsonc
// request - date required, the rest optional
{ "date": "2026-05-01", "amountSpent": 25.5, "notes": "Lunch" }

// 201
{
  "id": 4,
  "restaurantId": 1,
  "date": "2026-05-01",
  "amountSpent": 25.5,
  "notes": "Lunch",
  "createdAt": "2026-09-09T01:44:55.434Z"
}

// 400
{ "error": "Invalid request body", "details": ["date must not be in the future"] }
```

Rules: `date` is required and must be a real `YYYY-MM-DD` that isn't in the
future. `amountSpent` is optional, but if present it has to be a number, not
negative, at most two decimals, and fit `NUMERIC(10,2)`. `notes` is optional
text. `restaurantId` is deliberately read from the URL, not the body, so the two
can't disagree.

**`GET /api/spending`**

```jsonc
{
  "totalSpent": 162.25,
  "visitCount": 3,
  "restaurants": [
    {
      "restaurantId": 2,
      "name": "Sakura House",
      "visitCount": 1,
      "totalSpent": 88,
      "lastVisit": "2026-02-03"
    },
    {
      "restaurantId": 3,
      "name": "Bella Napoli",
      "visitCount": 0,
      "totalSpent": 0,
      "lastVisit": null
    }
  ]
}
```

Restaurants you've never been to are included at zero — those are the useful
rows, since they're the ones you can't see from the totals otherwise.

**Pages:** `/` (list + totals) and `/restaurants/[id]` (visits, a form, remove
buttons). Both server components; the form and remove button are client
components that call the same REST endpoints curl does. No Server Actions, no
direct database access from a page.

## Schema changes

None. The `visits` table in `001_create_tables.sql` already had everything I
needed, so there's no `002_` migration — `./setup.sh` is all you need.

Worth flagging one decision I inherited rather than made: `visits.restaurantId`
is `ON DELETE CASCADE`, so `DELETE /api/restaurants/:id` also deletes that
restaurant's visits. I left it. A visit doesn't mean much without the restaurant
it was at, and the alternative would leave rows you can't delete with no UI to
clear them. But it does mean that endpoint destroys more than its name suggests,
so it's worth knowing.

## How I verified this

No test suite, so this is all curl against a running dev server and a seeded
database.

**Part A** — every row of the contract table, including the errors:

```bash
curl -i http://localhost:3000/api/restaurants           # 200 + array
curl -i http://localhost:3000/api/restaurants/1         # 200
curl -i http://localhost:3000/api/restaurants/99999     # 404
curl -i http://localhost:3000/api/restaurants/abc       # 404, not 500
curl -i http://localhost:3000/api/restaurants/-1        # 404
curl -i http://localhost:3000/api/restaurants/1.5       # 404
curl -i http://localhost:3000/api/restaurants/99999999999  # 404 (overflows int4)

curl -i -X POST http://localhost:3000/api/restaurants \
  -H 'Content-Type: application/json' \
  -d '{"name":"Valid Spot","cuisine":"Test","address":"2 Test St","rating":4.5}'   # 201

curl -i -X POST http://localhost:3000/api/restaurants \
  -H 'Content-Type: application/json' -d '{"name":"X","rating":6}'                 # 400

curl -i -X POST http://localhost:3000/api/restaurants \
  -H 'Content-Type: application/json' -d '{"cuisine":"none"}'                      # 400, no name

curl -i -X POST http://localhost:3000/api/restaurants \
  -H 'Content-Type: application/json' -d '{"name":'                                # 400, bad JSON

curl -i -X PUT http://localhost:3000/api/restaurants/99999 \
  -H 'Content-Type: application/json' -d '{"name":"Ghost"}'                        # 404

curl -i -X DELETE http://localhost:3000/api/restaurants/1   # 204
curl -i -X DELETE http://localhost:3000/api/restaurants/1   # 404 the second time
```

**Part B:**

```bash
# happy path
curl -i http://localhost:3000/api/restaurants/1/visits
curl -i -X POST http://localhost:3000/api/restaurants/1/visits \
  -H 'Content-Type: application/json' \
  -d '{"date":"2026-05-01","amountSpent":25.50,"notes":"Lunch"}'   # 201
curl -i http://localhost:3000/api/spending

# missing restaurant / bad id -> 404, not 409 or 500
curl -i -X POST http://localhost:3000/api/restaurants/99999/visits \
  -H 'Content-Type: application/json' -d '{"date":"2026-05-01"}'
curl -i http://localhost:3000/api/restaurants/abc/visits

# body validation -> 400
-d '{"amountSpent":10}'                            # no date
-d '{"date":"2026-02-31"}'                         # not a real day
-d '{"date":"05/01/2026"}'                         # wrong format
-d '{"date":"2099-01-01"}'                         # future
-d '{"date":"2026-05-01","amountSpent":-5}'        # negative
-d '{"date":"2026-05-01","amountSpent":10.999}'    # 3 decimals
-d '{"date":"2026-05-01","amountSpent":"10"}'      # string, not number
-d '{"date":"2026-05-01","amountSpent":999999999}' # overflows NUMERIC(10,2)

# delete
curl -i -X DELETE http://localhost:3000/api/visits/4    # 204
curl -i -X DELETE http://localhost:3000/api/visits/4    # 404
curl -i -X DELETE http://localhost:3000/api/visits/abc  # 404, says "Visit not found"
```

Then the round trip through the UI: totals went `$162.25` → `$182.24` after
logging `$19.99` at Green Bowl, the restaurant moved off "never visited" on the
homepage, and deleting the visit put both back.

Two bugs I found doing this, both in my own Part B code:

- My "at most two decimals" check rejected `19.99`, because `19.99 * 100` is
  `1998.9999999999998` in floating point. My first pass at testing used `25.50`,
  which happens to be exact in binary, so I missed it. Compared with a tolerance
  now.
- `next build` reported `/api/spending` as static — it only exports `GET`, so
  Next was happy to prerender it and production would have served build-time
  totals forever. `/api/restaurants` only avoided this because it also exports
  `POST`. It's `force-dynamic` now. Dev mode never shows this, so it's worth
  running the build.

## Known issues / what I'd do next

- No automated tests. Everything above was checked by hand.
- No way to edit a visit — you delete and re-add.
- Validation errors come back as an array of strings, so a form can't tie a
  message to a field. A per-field shape would be better.
- Currency is hardcoded USD and formatted in the page.
- No pagination on visits. Fine for a few, not for a few thousand.
- `GET /api/restaurants` still returns everything with no filtering or sorting
  options, which is fine at this size and wouldn't be for long.
