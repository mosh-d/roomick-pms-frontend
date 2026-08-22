import { forwardRef, type TextareaHTMLAttributes } from 'react';

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  error?: string;
};

/** Same anatomy and forwardRef reasoning as Input.tsx — see that file's comment. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, id, name, rows = 4, className = '', ...rest },
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
      <textarea
        ref={ref}
        id={fieldId}
        name={name}
        rows={rows}
        aria-describedby={errorId ?? hintId}
        aria-invalid={Boolean(error)}
        className={`w-full min-h-24 resize-y bg-white border rounded-control px-4 py-2.5 text-body placeholder:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:pointer-events-none ${
          error ? 'border-red-600' : 'border-accent/40'
        } ${className}`}
        {...rest}
      />
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

export type { TextareaProps };
