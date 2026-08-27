'use client';

import { SearchIcon } from './Icons';
import { FIELD_PLACEHOLDER_CLASS, FIELD_UNDERLINE_CLASS } from './Input';

/**
 * The reference's list-page search field (Roomick-UI.pdf p11/p18): a
 * magnifier icon, an underline field, no visible label. Reuses `Input.tsx`'s
 * exported underline/placeholder constants rather than a hand-copied
 * near-match — same shared-tone discipline `Select`/`Textarea` already follow.
 *
 * Filtering is the caller's job (client-side over already-fetched rows in
 * every current usage) — this only owns the field.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search',
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Screen-reader-only label — the reference shows no visible one, but the field still needs a name. */
  label: string;
}) {
  return (
    <div className="relative flex items-center max-w-xs w-full">
      <SearchIcon className="absolute left-0 size-4 shrink-0 text-accent-dark pointer-events-none" />
      <input
        type="search"
        aria-label={label}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full bg-transparent border-0 border-b pb-1 pl-6 text-body ${FIELD_PLACEHOLDER_CLASS} ${FIELD_UNDERLINE_CLASS} focus:outline-none focus:border-primary transition-colors`}
      />
    </div>
  );
}
