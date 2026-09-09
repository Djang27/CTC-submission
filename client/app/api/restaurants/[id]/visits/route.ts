import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { handleError, NotFoundError } from '@/lib/errors';
import { toVisit } from '@/lib/types';
import { VISIT_COLUMNS } from '@/lib/sql';
import { parseId, parseVisitInput } from '@/lib/validation';

type Params = { params: { id: string } };

/**
 * Visits are nested under a restaurant because a visit has no meaning without
 * one - you can't list or create them except in that context, and the FK is
 * ON DELETE CASCADE for the same reason.
 */

/** Confirm the restaurant exists, so a missing one is a 404 and not a 409. */
async function assertRestaurantExists(id: number): Promise<void> {
  const { rowCount } = await pool.query(
    'SELECT 1 FROM restaurants WHERE id = $1',
    [id]
  );
  if (rowCount === 0) throw new NotFoundError();
}

/**
 * GET /api/restaurants/:id/visits
 * Visits for one restaurant, most recent first. 404 if the restaurant is gone.
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const restaurantId = parseId(params.id);
    await assertRestaurantExists(restaurantId);

    // `id DESC` breaks ties: `date` is a calendar day, so several visits to the
    // same place on one day would otherwise come back in arbitrary order.
    const { rows } = await pool.query(
      `SELECT ${VISIT_COLUMNS}
         FROM visits
        WHERE "restaurantId" = $1
        ORDER BY date DESC, id DESC`,
      [restaurantId]
    );

    return NextResponse.json(rows.map(toVisit));
  } catch (err) {
    return handleError(err);
  }
}

/**
 * POST /api/restaurants/:id/visits
 * Log a visit. 201 with the created record, 400 on a bad body, 404 if the
 * restaurant doesn't exist.
 *
 * The existence check above is what makes that last case a 404. Without it the
 * insert trips the foreign key and surfaces as a 409, which would be the wrong
 * answer: nothing conflicts, the restaurant simply isn't there.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const restaurantId = parseId(params.id);
    const { date, amountSpent, notes } = parseVisitInput(await req.json());

    await assertRestaurantExists(restaurantId);

    const { rows } = await pool.query(
      `INSERT INTO visits ("restaurantId", date, "amountSpent", notes)
       VALUES ($1, $2, $3, $4)
       RETURNING ${VISIT_COLUMNS}`,
      [restaurantId, date, amountSpent, notes]
    );

    return NextResponse.json(toVisit(rows[0]), { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
