import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { handleError } from '@/lib/errors';
import { toRestaurant } from '@/lib/types';

/**
 * GET /api/restaurants
 * Returns all restaurants.
 */
export async function GET() {
  try {
    // Columns are snake_case in the migration (001_create_tables.sql), but the
    // API contract is camelCase. Alias `created_at` so the row keys match what
    // toRestaurant() reads; unquoted `createdAt` would fold to `createdat` and
    // error, and a bare `SELECT *` would yield `created_at` and map to
    // "undefined".
    //
    // `id DESC` is a tiebreaker: the seed inserts every row in one transaction,
    // so `now()` gives them all an identical created_at and the sort would
    // otherwise be non-deterministic.
    const { rows } = await pool.query(
      `SELECT id, name, cuisine, address, rating, created_at AS "createdAt"
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
 * Create a new restaurant.
 *
 * TODO (A2): implement. Read the restaurant fields from the request body,
 * insert a row, and return the created restaurant with a 201 status.
 *
 * TODO (A3): validate before you insert. Nothing validates anything today, so
 * `rating` happily accepts 6. Decide what valid means for each field and reject
 * bad bodies with a 400 rather than letting them reach the database.
 */
export async function POST(_req: Request) {
  return NextResponse.json({ error: 'Not implemented' }, { status: 501 });
}
