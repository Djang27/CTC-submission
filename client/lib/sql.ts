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
