import type { ReactNode } from 'react';

/**
 * A real <fieldset>/<legend> pair, not a styled <div> with a floating
 * label — this gets the reference image's "dashed border with a label"
 * look essentially for free from native HTML, AND gives screen readers
 * real grouping semantics (announcing the legend when any field inside
 * the fieldset receives focus) that a div-based approximation wouldn't.
 */
export function FormSection({
  label,
  className = '',
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className={`border border-dashed border-accent/60 rounded-card p-4 ${className}`}>
      <legend className="px-2 text-small font-semibold text-secondary">{label}</legend>
      <div className="flex flex-col gap-4">{children}</div>
    </fieldset>
  );
}
