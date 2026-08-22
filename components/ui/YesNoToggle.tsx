'use client';

type YesNoValue = 'yes' | 'no';

/**
 * Built on real native <input type="radio"> elements, visually hidden with
 * `sr-only` (not `display: none` — sr-only keeps the input in the
 * accessibility tree and tabbable, just invisible) with a styled <label>
 * sibling doing the visible pill rendering. This gets full keyboard
 * (Tab/Arrow-key) and screen-reader support for free from the browser's
 * native radio-group behavior — unlike Select.tsx, where no native element
 * can produce the required visual, so ARIA roles have to be hand-rolled
 * there instead. Prefer native semantics whenever the visual allows it.
 */
export function YesNoToggle({
  label,
  name,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  name: string;
  value: YesNoValue | null;
  onChange: (value: YesNoValue) => void;
  disabled?: boolean;
}) {
  const options: { value: YesNoValue; text: string }[] = [
    { value: 'yes', text: 'Yes' },
    { value: 'no', text: 'No' },
  ];

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-small font-semibold text-secondary">{label}</span>
      <div role="radiogroup" aria-label={label} className="inline-flex gap-2">
        {options.map((option) => {
          const isSelected = value === option.value;
          const inputId = `${name}-${option.value}`;
          return (
            <div key={option.value}>
              <input
                type="radio"
                id={inputId}
                name={name}
                value={option.value}
                checked={isSelected}
                disabled={disabled}
                onChange={() => onChange(option.value)}
                className="sr-only peer"
              />
              <label
                htmlFor={inputId}
                className={`inline-flex items-center justify-center min-h-11 min-w-16 px-4 rounded-pill border text-body font-semibold cursor-pointer transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-disabled:opacity-50 peer-disabled:pointer-events-none ${
                  isSelected ? 'bg-primary text-secondary border-primary' : 'border-accent/40 text-secondary'
                }`}
              >
                {option.text}
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
