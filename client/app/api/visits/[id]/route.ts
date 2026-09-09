import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { handleError, NotFoundError } from '@/lib/errors';
import { parseId } from '@/lib/validation';

type Params = { params: { id: string } };

/**
 * DELETE /api/visits/:id
 * Remove a visit. 204, or 404 if it doesn't exist.
 *
 * Flat rather than nested under the restaurant: a visit id already identifies
 * one row, so /api/restaurants/:rid/visits/:id would take a second id that adds
 * nothing and can contradict the first. Listing and creating need the
 * restaurant for context; deleting doesn't.
 *
 * There's no PUT. Correcting a mislogged visit by deleting and re-adding is
 * good enough for now, and an update would double the validation surface.
 */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const id = parseId(params.id, 'Visit not found');

    const { rowCount } = await pool.query('DELETE FROM visits WHERE id = $1', [id]);
    if (rowCount === 0) throw new NotFoundError('Visit not found');

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleError(err);
  }
}
