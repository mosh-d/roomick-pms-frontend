'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeftIcon } from './Icons';

/**
 * Sits above `PageHeader` on a "drilled into" detail page (Check-In Flow,
 * Registration Card, Guest Folio — reached by clicking into a row from a
 * list, not primary sidebar destinations) so getting back doesn't depend
 * on the browser's own back button. `router.back()`, not a hardcoded
 * route: correct regardless of which list — Arrivals, In-House Guest List,
 * Billing — the page was actually entered from. `fallbackHref` covers the
 * one edge case `back()` can't: a deep link opened with no prior history
 * (a bookmark, a shared URL) — the page's own natural parent instead of
 * `back()` in that same rare situation.
 */
export function BackButton({ label = 'Back', fallbackHref }: { label?: string; fallbackHref?: string }) {
  const router = useRouter();

  function handleClick() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else if (fallbackHref) {
      router.push(fallbackHref);
    } else {
      router.back();
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex w-fit items-center gap-1.5 text-small font-semibold text-secondary-light hover:text-secondary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-control"
    >
      <ArrowLeftIcon className="size-3.5" />
      {label}
    </button>
  );
}
