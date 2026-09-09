import Link from 'next/link';
import { notFound } from 'next/navigation';
import { API_URL, getVisits } from '@/lib/apiClient';
import type { Restaurant } from '@/lib/types';
import DeleteVisitButton from './DeleteVisitButton';
import VisitForm from './VisitForm';

/** Money, for display only - the API always speaks plain numbers. */
function money(amount: number): string {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/**
 * One restaurant: what it is, what it has cost, and every visit logged to it.
 *
 * A server component. It reaches the data over HTTP like any other client, so
 * the page can't see anything the API wouldn't also give you from curl.
 */
export default async function RestaurantPage({
  params,
}: {
  params: { id: string };
}) {
  // Fetched here rather than through getRestaurant() because a 404 has to be
  // distinguishable from a hit: that helper returns res.json() without checking
  // the status, so a missing restaurant would render as a card with undefined
  // fields instead of Next's not-found page.
  const res = await fetch(`${API_URL}/api/restaurants/${params.id}`, {
    cache: 'no-store',
  });
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error(`Failed to load restaurant (${res.status})`);

  const restaurant: Restaurant = await res.json();
  const visits = await getVisits(params.id);

  const total = visits.reduce((sum, visit) => sum + (visit.amountSpent ?? 0), 0);

  return (
    <div>
      <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">
        &larr; All restaurants
      </Link>

      <div className="mt-4 flex items-baseline justify-between">
        <h2 className="text-lg font-medium">{restaurant.name}</h2>
        {restaurant.rating !== null && (
          <span className="text-sm text-gray-500">{restaurant.rating}★</span>
        )}
      </div>
      <p className="text-sm text-gray-600">
        {[restaurant.cuisine, restaurant.address].filter(Boolean).join(' · ')}
      </p>

      <dl className="mt-4 flex gap-8 rounded-lg border border-gray-200 bg-white p-4">
        <div>
          <dt className="text-sm text-gray-500">Total spent</dt>
          <dd className="text-lg font-medium">{money(total)}</dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Visits</dt>
          <dd className="text-lg font-medium">{visits.length}</dd>
        </div>
      </dl>

      <div className="mt-6">
        <VisitForm restaurantId={restaurant.id} />
      </div>

      <h3 className="mb-3 mt-8 font-medium">Visits</h3>
      {visits.length === 0 ? (
        <p className="text-sm text-gray-500">
          No visits logged yet. Add one above.
        </p>
      ) : (
        <ul className="space-y-2">
          {visits.map((visit) => (
            <li
              key={visit.id}
              className="flex items-baseline justify-between rounded-lg border border-gray-200 bg-white p-3"
            >
              <div>
                <span className="text-sm font-medium">{visit.date}</span>
                {visit.notes && (
                  <span className="ml-3 text-sm text-gray-600">{visit.notes}</span>
                )}
              </div>
              <div className="flex items-baseline gap-4">
                <span className="text-sm">
                  {visit.amountSpent === null ? (
                    <span className="text-gray-400">not recorded</span>
                  ) : (
                    money(visit.amountSpent)
                  )}
                </span>
                <DeleteVisitButton visitId={visit.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
