'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Log a visit.
 *
 * A client component because it's the only interactive part of the page - the
 * rest stays a server component. It POSTs to the REST API like any other client
 * would; there are no Server Actions here, so this is the same endpoint curl
 * hits.
 *
 * Validation deliberately isn't duplicated in here. The API is the thing that
 * decides what's valid, and re-implementing the rules client-side means two
 * copies to keep in step. Instead the 400's `details` are rendered as-is, so
 * what the user sees is what the server actually objected to.
 */
export default function VisitForm({ restaurantId }: { restaurantId: number }) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setErrors([]);

    try {
      const res = await fetch(`/api/restaurants/${restaurantId}/visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          // An empty amount field means "didn't record it", not zero.
          amountSpent: amount === '' ? null : Number(amount),
          notes: notes.trim() === '' ? null : notes,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErrors(body.details ?? [body.error ?? 'Could not save that visit']);
        return;
      }

      setAmount('');
      setNotes('');
      // The page is a server component, so re-fetch it rather than trying to
      // splice the new visit into local state - that keeps the totals honest.
      router.refresh();
    } catch {
      setErrors(['Could not reach the server']);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-3 font-medium">Log a visit</h3>

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col text-sm">
          <span className="mb-1 text-gray-600">Date</span>
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1"
            required
          />
        </label>

        <label className="flex flex-col text-sm">
          <span className="mb-1 text-gray-600">Amount</span>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-28 rounded border border-gray-300 px-2 py-1"
          />
        </label>

        <label className="flex flex-1 flex-col text-sm">
          <span className="mb-1 text-gray-600">Notes</span>
          <input
            type="text"
            placeholder="Optional"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1"
          />
        </label>
      </div>

      {errors.length > 0 && (
        <ul className="mt-3 list-inside list-disc text-sm text-red-600">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      <button
        type="submit"
        disabled={saving}
        className="mt-3 rounded bg-gray-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Add visit'}
      </button>
    </form>
  );
}
