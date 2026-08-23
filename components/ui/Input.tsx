'use client';

import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { EyeIcon, EyeOffIcon, InfoCircleIcon } from './Icons';

/**
 * The underline field's at-rest tone — shared, not re-tuned per component:
 * `Select.tsx`'s trigger, `Textarea.tsx`, and `MultiSelectTagInput.tsx`'s
 * free-text row all import these two exact strings rather than keeping
 * their own copy. They used to each hand-roll the same pair independently
 * and drifted (all three briefly styled it with `accent`, the "quiet,
 * non-interactive" token, on a field you're meant to type into) — caught
 * live, fixed in one place instead of three separate ones this time.
 */
export const FIELD_PLACEHOLDER_CLASS = 'placeholder:text-secondary-light';
export const FIELD_UNDERLINE_CLASS = 'border-secondary-light/40 focus:border-secondary';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  /** Shown as a small info-icon row below the field (hover/focus reveals the text via `title`) — matches the reference product's field anatomy, present on nearly every field. */
  hint?: string;
  error?: string;
  /** Fixed, non-editable text before the field's value — e.g. a phone field's `+234` calling-code badge, derived from a country the user already picked elsewhere. */
  prefix?: string;
  /** Fixed, non-editable text after the field's value — e.g. a room-size field's `m²` unit. */
  suffix?: string;
};

/**
 * forwardRef is required here (not just nice-to-have): React Hook Form's
 * `register()` returns a `ref` callback that must attach directly to the
 * DOM <input>, not to this wrapper component — without forwardRef, RHF
 * can't read the field's live value on blur/change and validation breaks
 * silently.
 *
 * Label is always rendered above the field, never as the only label via a
 * placeholder — placeholder-only labels fail accessibility (no persistent
 * association for screen readers) and disappear the moment a user starts
 * typing, which is worse for a fast-paced front-desk workflow, not better.
 *
 * Field anatomy matches the actual product reference (Roomick-UI.pdf), not
 * a generic bordered-box input: an underline (bottom border only, no full
 * box) beneath the value, with the info icon on its own row below that —
 * not floating inside the field. On focus, the whole label+field+icon
 * group gets a light secondary-tint background (`focus-within`, not a
 * ring) and the underline becomes solid secondary — visible on "Last Name"
 * in the reference's Owner Account Form.
 *
 * The `-mx-3`/`px-3` pairing is a deliberate zero-layout-shift trick: the
 * padding is always reserved, but its background is transparent until
 * `focus-within`, and the matching negative margin cancels the padding's
 * visual indent at rest — so the field doesn't jump or reflow when it
 * gains the tinted focus box.
 *
 * `type="password"` gets a built-in reveal toggle (own `useState`, hence
 * this file needing `'use client'` now) rather than relying on the
 * browser's native reveal icon — Chrome's native one is inconsistent about
 * when it reappears after a field loses and regains focus, which read as a
 * bug ("I can't see what I typed anymore"). Controlling it ourselves means
 * it behaves the same way every time.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, prefix, suffix, id, name, type, className = '', ...rest },
  ref,
) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === 'password';
  const fieldId = id ?? name;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1 rounded-control px-3 -mx-3 py-2 transition-colors focus-within:bg-secondary-light/15">
      <label htmlFor={fieldId} className="text-small font-semibold text-secondary">
        {label}
      </label>
      <div className="relative flex items-center">
        {prefix ? (
          <span className="pb-1 pr-1.5 text-body text-secondary-light shrink-0" aria-hidden="true">
            {prefix}
          </span>
        ) : null}
        <input
          ref={ref}
          id={fieldId}
          name={name}
          type={isPassword ? (revealed ? 'text' : 'password') : type}
          // aria-describedby links the field to its hint/error text so
          // screen readers announce them — both are included when both are
          // present, not just one.
          aria-describedby={describedBy}
          aria-invalid={Boolean(error)}
          className={`w-full bg-transparent border-0 border-b pb-1 text-body ${FIELD_PLACEHOLDER_CLASS} focus:outline-none disabled:opacity-50 disabled:pointer-events-none ${
            isPassword ? 'pr-7' : ''
          } ${error ? 'border-red-600' : FIELD_UNDERLINE_CLASS} ${className}`}
          {...rest}
        />
        {suffix ? (
          <span className="pb-1 pl-1.5 text-body text-secondary-light shrink-0" aria-hidden="true">
            {suffix}
          </span>
        ) : null}
        {isPassword ? (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            className="absolute right-0 text-accent-dark hover:text-secondary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-control"
          >
            {revealed ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        ) : null}
      </div>
      {hint || error ? (
        <span className="mt-1 inline-flex items-start gap-1.5">
          {hint ? (
            <span className="inline-flex shrink-0 text-accent-dark" title={hint}>
              <InfoCircleIcon />
              <span id={hintId} className="sr-only">
                {hint}
              </span>
            </span>
          ) : null}
          {error ? (
            <span id={errorId} className="text-small text-red-600">
              {error}
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
});

export type { InputProps };
