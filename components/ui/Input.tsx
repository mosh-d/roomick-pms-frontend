import { forwardRef, type InputHTMLAttributes } from 'react';
import { InfoCircleIcon } from './Icons';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  /** Optional trailing helper icon (reference image: an info "ⓘ" glyph next to the field) — defaults to an InfoCircleIcon when `hint` is set. */
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
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, id, name, className = '', ...rest },
  ref,
) {
  const fieldId = id ?? name;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-small font-semibold text-secondary">
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={fieldId}
          name={name}
          // aria-describedby links the field to its hint/error text so
          // screen readers announce them — error takes priority when both
          // are present since it's the more urgent message.
          aria-describedby={errorId ?? hintId}
          aria-invalid={Boolean(error)}
          className={`w-full bg-white border rounded-control px-4 py-2.5 text-body placeholder:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:pointer-events-none ${
            error ? 'border-red-600' : 'border-accent/40'
          } ${hint ? 'pr-9' : ''} ${className}`}
          {...rest}
        />
        {hint ? (
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 text-accent-dark"
            title={hint}
          >
            <InfoCircleIcon />
          </span>
        ) : null}
      </div>
      {error ? (
        <p id={errorId} className="text-small text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-small text-secondary-light">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

export type { InputProps };
