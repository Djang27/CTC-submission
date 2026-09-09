import Link from 'next/link';
import { getRestaurants, getSpending } from '@/lib/apiClient';

function money(amount: number): string {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/**
 * The restaurant list, with what each one has cost.
 *
 * Two requests rather than one: /api/restaurants owns the restaurant fields and
 * /api/spending owns the aggregates. Folding the totals into the restaurant
 * payload would have been one fetch, but Part A fixes that response shape, and
 * a list endpoint that silently runs a join is a worse trade than a second
 * call. They're issued together, so it costs a round trip, not two.
 */
export default async function HomePage() {
  const [restaurants, spending] = await Promise.all([
    getRestaurants(),
    getSpending(),
  ]);

  const byRestaurant = new Map(
    spending.restaurants.map((row) => [row.restaurantId, row])
  );

  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between rounded-lg border border-gray-200 bg-white p-4">
        <div>
          <div className="text-sm text-gray-500">Total spent</div>
          <div className="text-2xl font-medium">{money(spending.totalSpent)}</div>
        </div>
        <div className="text-sm text-gray-500">
          {spending.visitCount} {spending.visitCount === 1 ? 'visit' : 'visits'}
        </div>
      </div>

      <h2 className="mb-4 text-lg font-medium">Restaurants</h2>
      <ul className="space-y-3">
        {restaurants.map((restaurant) => {
          const spent = byRestaurant.get(restaurant.id);
          return (
            <li
              key={restaurant.id}
              className="rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="flex items-baseline justify-between">
                <Link
                  href={`/restaurants/${restaurant.id}`}
                  className="font-medium hover:underline"
                >
                  {restaurant.name}
                </Link>
                <span className="text-sm text-gray-500">{restaurant.rating}★</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-sm text-gray-600">
                  {restaurant.cuisine} · {restaurant.address}
                </span>
                <span className="text-sm text-gray-600">
                  {spent && spent.visitCount > 0 ? (
                    <>
                      {money(spent.totalSpent)}
                      <span className="text-gray-400">
                        {' '}
                        · {spent.visitCount}{' '}
                        {spent.visitCount === 1 ? 'visit' : 'visits'}
                      </span>
                    </>
                  ) : (
                    <span className="text-gray-400">never visited</span>
                  )}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
