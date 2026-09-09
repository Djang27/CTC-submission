import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { handleError } from '@/lib/errors';
import { toRestaurant } from '@/lib/types';
import { RESTAURANT_COLUMNS } from '@/lib/sql';

type Params = { params: { id: string } };

/**
 * GET /api/restaurants/:id
 * Returns a single restaurant, or 404 if it doesn't exist.
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const { rows } = await pool.query(
      `SELECT ${RESTAURANT_COLUMNS}
         FROM restaurants
        WHERE id = $1`,
      [params.id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }

    return NextResponse.json(toRestaurant(rows[0]));
  } catch (err) {
    return handleError(err);
  }
}

/**
 * PUT /api/restaurants/:id
 * Replace an existing restaurant. Returns the updated record, or 404.
 *
 * PUT replaces rather than merges: the body carries the same shape POST takes,
 * and an omitted optional field is written as NULL rather than left alone. That
 * is what PUT means in HTTP - a partial merge would be PATCH, which this API
 * doesn't expose.
 *
 * TODO (A3): validate the body the same way POST does, and answer 404 rather
 * than 500 when :id isn't a positive integer.
 */
export async function PUT(req: Request, { params }: Params) {
  try {
    const { name, cuisine, address, rating } = await req.json();

    const { rows } = await pool.query(
      `UPDATE restaurants
          SET name = $1, cuisine = $2, address = $3, rating = $4
        WHERE id = $5
        RETURNING ${RESTAURANT_COLUMNS}`,
      [name, cuisine ?? null, address ?? null, rating ?? null, params.id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }

    return NextResponse.json(toRestaurant(rows[0]));
  } catch (err) {
    return handleError(err);
  }
}

/**
 * DELETE /api/restaurants/:id
 * Delete a restaurant. Returns 204 with no body, or 404.
 *
 * `visits.restaurantId` is declared ON DELETE CASCADE in 001_create_tables.sql,
 * so this also deletes that restaurant's visits. That's the right call for now:
 * a visit has no meaning without the restaurant it belongs to, and the
 * alternative (RESTRICT) would leave rows undeletable with no UI to clear them.
 * It does mean the endpoint destroys more than its name suggests - see WriteUp.
 *
 * TODO (A3): answer 404 rather than 500 when :id isn't a positive integer.
 */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM restaurants WHERE id = $1',
      [params.id]
    );

    if (rowCount === 0) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }

    // 204 means "no content" - it must not carry a body, so this can't use
    // NextResponse.json().
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleError(err);
  }
}
