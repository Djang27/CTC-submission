import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { handleError } from '@/lib/errors';
import { toRestaurantSpending, type SpendingSummary } from '@/lib/types';

/**
 * GET /api/spending
 * What has been spent, per restaurant and overall.
 *
 * This is the point of the app - the restaurant list alone never answers "where
 * is the money going". It's a read-only view over `visits`, so there's nothing
 * to validate and no way for it to 404: an empty database is a real answer
 * (zeroes), not a missing resource.
 */
/**
 * This route only exports GET, which makes Next eligible to prerender it at
 * build time - `next build` reported it as static, meaning production would
 * have served build-time totals forever. The reads below are live by
 * definition, so opt out explicitly. Dev never shows this; only `npm run build`
 * does.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Aggregated in SQL rather than by summing rows in JS. Postgres sums
    // NUMERIC exactly; adding the same values as JS floats would drift
    // (0.1 + 0.2), which is the wrong property for money.
    //
    // LEFT JOIN keeps restaurants with no visits, showing them at zero. Those
    // are the useful rows - a place you've never been is exactly what you can't
    // see from the totals otherwise.
    const perRestaurant = pool.query(
      `SELECT r.id                                  AS "restaurantId",
              r.name                                AS name,
              COUNT(v.id)                           AS "visitCount",
              COALESCE(SUM(v."amountSpent"), 0)     AS "totalSpent",
              MAX(v.date)                           AS "lastVisit"
         FROM restaurants r
         LEFT JOIN visits v ON v."restaurantId" = r.id
        GROUP BY r.id, r.name
        ORDER BY COALESCE(SUM(v."amountSpent"), 0) DESC, r.name ASC`
    );

    // Totalled separately rather than folded from the rows above, for the same
    // exactness reason.
    const overall = pool.query(
      `SELECT COALESCE(SUM("amountSpent"), 0) AS "totalSpent",
              COUNT(*)                        AS "visitCount"
         FROM visits`
    );

    const [rows, totals] = await Promise.all([perRestaurant, overall]);

    const summary: SpendingSummary = {
      totalSpent: Number(totals.rows[0].totalSpent),
      visitCount: Number(totals.rows[0].visitCount),
      restaurants: rows.rows.map(toRestaurantSpending),
    };

    return NextResponse.json(summary);
  } catch (err) {
    return handleError(err);
  }
}
