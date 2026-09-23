import { LISTING_STATE_LABELS, type ListingState } from '@/lib/marketplace';

const STATE_CLASSES: Record<ListingState, string> = {
  on: 'bg-green-100 text-green-800',
  off: 'bg-secondary/10 text-secondary',
  not_set_up: 'bg-blue-100 text-blue-800',
  coming_later: 'bg-secondary/10 text-secondary/60',
};

/** Shared by the catalogue and a listing's own page, so "On" means the same thing on both. */
export function ListingStateBadge({ state }: { state: ListingState }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-tiny font-semibold ${STATE_CLASSES[state]}`}>{LISTING_STATE_LABELS[state]}</span>;
}
