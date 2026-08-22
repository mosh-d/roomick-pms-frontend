import { forwardRef, type InputHTMLAttributes } from 'react';
import { InfoCircleIcon } from './Icons';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  /** Shown as a small info-icon row below the field (hover/focus reveals the text via `title`) — matches the reference product's field anatomy, present on nearly every field. */
  hint?: string;
  error?: string;
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
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, id, name, className = '', ...rest },
  ref,
) {
  const fieldId = id ?? name;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1 rounded-control px-3 -mx-3 py-2 transition-colors focus-within:bg-secondary-light/15">
      <label htmlFor={fieldId} className="text-small font-semibold text-secondary">
        {label}
      </label>
      <input
        ref={ref}
        id={fieldId}
        name={name}
        // aria-describedby links the field to its hint/error text so
        // screen readers announce them — error takes priority when both
        // are present since it's the more urgent message.
        aria-describedby={errorId ?? hintId}
        aria-invalid={Boolean(error)}
        className={`w-full bg-transparent border-0 border-b pb-1 text-body placeholder:text-accent focus:outline-none disabled:opacity-50 disabled:pointer-events-none ${
          error ? 'border-red-600' : 'border-accent/40 focus:border-secondary'
        } ${className}`}
        {...rest}
      />
      {error ? (
        <p id={errorId} className="text-small text-red-600 mt-1">
          {error}
        </p>
      ) : hint ? (
        <span className="mt-1 inline-flex text-accent-dark" title={hint}>
          <InfoCircleIcon />
          <span id={hintId} className="sr-only">
            {hint}
          </span>
        </span>
      ) : null}
    </div>
  );
});

export type { InputProps };
