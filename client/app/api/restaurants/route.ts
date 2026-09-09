import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { handleError } from '@/lib/errors';
import { toRestaurant } from '@/lib/types';
import { RESTAURANT_COLUMNS } from '@/lib/sql';
import { parseRestaurantInput } from '@/lib/validation';

/**
 * GET /api/restaurants
 * Returns all restaurants.
 */
export async function GET() {
  try {
    // `id DESC` is a tiebreaker: the seed inserts every row in one transaction,
    // so `now()` gives them all an identical created_at and the sort would
    // otherwise be non-deterministic.
    const { rows } = await pool.query(
      `SELECT ${RESTAURANT_COLUMNS}
         FROM restaurants
        ORDER BY created_at DESC, id DESC`
    );
    // Map every row - raw rows don't match the contract (NUMERIC comes back
    // as a string, timestamps as Date objects). See lib/types.ts.
    return NextResponse.json(rows.map(toRestaurant));
  } catch (err) {
    return handleError(err);
  }
}

/**
 * POST /api/restaurants
 * Create a new restaurant. Returns the created record with 201, or 400 if the
 * body is malformed or fails validation.
 */
export async function POST(req: Request) {
  try {
    // Validate first: a rejected body never reaches the database, so a bad
    // request fails as a 400 we wrote rather than a constraint we translated.
    const { name, cuisine, address, rating } = parseRestaurantInput(
      await req.json()
    );

    const { rows } = await pool.query(
      `INSERT INTO restaurants (name, cuisine, address, rating)
       VALUES ($1, $2, $3, $4)
       RETURNING ${RESTAURANT_COLUMNS}`,
      [name, cuisine, address, rating]
    );

    return NextResponse.json(toRestaurant(rows[0]), { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
