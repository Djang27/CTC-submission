/**
 * Shared SQL fragments.
 *
 * The `restaurants` table is snake_case (`created_at`) but the API contract is
 * camelCase (`createdAt`), and `toRestaurant()` in lib/types.ts reads the
 * camelCase key. A bare `SELECT *` or `RETURNING *` therefore hands the mapper
 * a key it doesn't read, and the response goes out with
 * `"createdAt": "undefined"` - a 200 that silently breaks the contract.
 *
 * That was the A1 bug. Keeping the projection in one place means every query,
 * including the `RETURNING` clauses on the write endpoints, gets the alias.
 */
export const RESTAURANT_COLUMNS =
  'id, name, cuisine, address, rating, created_at AS "createdAt"';

/**
 * `visits` is inconsistent with itself: `restaurantId` and `amountSpent` were
 * created quoted, so they're already camelCase, but `created_at` wasn't. Only
 * the timestamp needs aliasing - the same trap as `restaurants`, in a table
 * where most columns don't need it.
 */
export const VISIT_COLUMNS =
  'id, "restaurantId", date, "amountSpent", notes, created_at AS "createdAt"';
