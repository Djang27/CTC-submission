/**
 * The client side of the API: helpers the frontend uses to call the endpoints.
 *
 * Don't confuse this with `app/api/`, which is the other side of the same
 * boundary - the route handlers that *implement* those endpoints. This file
 * only ever talks to them over HTTP.
 *
 * The shapes these helpers return live in `lib/types.ts`, shared with the
 * handlers that produce them.
 */
import type { Restaurant, SpendingSummary, Visit } from './types';

// We read a base URL from the environment because Server Components fetch on
// the server, where relative URLs don't resolve - so we need an absolute origin.
// It's the same app on the same port, so this is normally just localhost:3000.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Fetch every restaurant from the API.
 *
 * The status check matters more than it looks: without it a 500 returns the
 * error object `{ error: ... }`, the page calls `.map()` on it, and the user
 * sees "restaurants.map is not a function" instead of anything about the
 * actual failure. That's how the A1 bug presented itself.
 */
export async function getRestaurants(): Promise<Restaurant[]> {
  const res = await fetch(`${API_URL}/api/restaurants`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load restaurants (${res.status})`);
  return res.json();
}

/**
 * Fetch a single restaurant by id.
 */
export async function getRestaurant(id: number | string): Promise<Restaurant> {
  const res = await fetch(`${API_URL}/api/restaurants/${id}`, { cache: 'no-store' });
  return res.json();
}

/**
 * Fetch one restaurant's visits, newest first.
 *
 * Unlike the two helpers above this one checks the status: a 404 here is a real
 * answer (the restaurant is gone), and returning `res.json()` blindly would
 * hand the page an error object to render as a list - which is exactly how the
 * A1 bug reached the UI.
 */
export async function getVisits(id: number | string): Promise<Visit[]> {
  const res = await fetch(`${API_URL}/api/restaurants/${id}/visits`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to load visits (${res.status})`);
  return res.json();
}

/** Fetch the spending summary: per-restaurant totals plus the overall figure. */
export async function getSpending(): Promise<SpendingSummary> {
  const res = await fetch(`${API_URL}/api/spending`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load spending (${res.status})`);
  return res.json();
}
