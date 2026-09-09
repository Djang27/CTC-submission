'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Remove a mislogged visit. There's no edit, so this is the correction path. */
export default function DeleteVisitButton({ visitId }: { visitId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    setBusy(true);
    const res = await fetch(`/api/visits/${visitId}`, { method: 'DELETE' });
    // A 404 means someone else already deleted it, which is the outcome we
    // wanted anyway - refresh either way.
    if (res.ok || res.status === 404) router.refresh();
    setBusy(false);
  }

  return (
    <button
      onClick={onDelete}
      disabled={busy}
      className="text-sm text-gray-400 hover:text-red-600 disabled:opacity-50"
      aria-label="Delete visit"
    >
      Remove
    </button>
  );
}
