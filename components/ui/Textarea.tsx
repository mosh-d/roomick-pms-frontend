import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { InfoCircleIcon } from './Icons';
import { FIELD_PLACEHOLDER_CLASS, FIELD_UNDERLINE_CLASS } from './Input';

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  error?: string;
};

/** Same anatomy, focus-within tint, and forwardRef reasoning as Input.tsx — see that file's comment. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, id, name, rows = 3, className = '', ...rest },
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
      <textarea
        ref={ref}
        id={fieldId}
        name={name}
        rows={rows}
        aria-describedby={errorId ?? hintId}
        aria-invalid={Boolean(error)}
        className={`w-full resize-y bg-transparent border-0 border-b pb-1 text-body ${FIELD_PLACEHOLDER_CLASS} focus:outline-none disabled:opacity-50 disabled:pointer-events-none ${
          error ? 'border-red-600' : FIELD_UNDERLINE_CLASS
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

export type { TextareaProps };
