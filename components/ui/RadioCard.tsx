'use client';

import type { ReactNode } from 'react';
import { Card, CARD_TONE_CLASSES, type CardTone } from './Card';

export type RadioCardOption<T extends string> = {
  value: T;
  title: string;
  /**
   * When present, this option renders as a full bordered/tinted card
   * (radio + title + description). When omitted, it renders as a plain
   * radio + label with no card chrome at all. This — not a variant prop —
   * is what makes Brand Mode's plain options and a hypothetical described
   * option come out looking different: same component, same code path,
   * different data.
   */
  description?: string;
  /**
   * Rendered once, below the whole options row, when this option is the
   * selected one — nested in its own `Card` (reusing the opacity-nesting
   * mechanic, see 01-color.md).
   */
  content?: ReactNode;
};

/**
 * The general-purpose "radio selection whose content changes based on
 * which option is picked" primitive — ONE rendering path, not a variant
 * switch. Two things this gets from the reference (Roomick-UI.pdf),
 * corrected after closer review:
 *
 * 1. Options render **inline, on one row** (`flex flex-wrap`), not
 *    stacked one per line — every plain-radio-row example in the
 *    reference (Digital/Manual Capture, Fixed/Percentage Rate, Single/
 *    Multi-Brand Structure) puts both choices side by side.
 * 2. The selected option's `content` renders **once, below the whole
 *    row** — not nested under that specific option's position in a
 *    vertical stack (there is no vertical stack). An option with a
 *    `description` gets full card chrome; one without renders as a plain
 *    radio + label.
 *
 * The radio dot is always `secondary` (near-black), never `tone` or
 * primary gold — it's UI chrome, not part of the content-tint system.
 */
export function RadioCard<T extends string>({
  options,
  value,
  onChange,
  name,
  tone = 'secondary',
  disabled = false,
}: {
  options: RadioCardOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  name: string;
  tone?: CardTone;
  disabled?: boolean;
}) {
  const selected = options.find((option) => option.value === value);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-stretch gap-x-8 gap-y-3">
        {options.map((option) => {
          const isSelected = option.value === value;
          const inputId = `${name}-${option.value}`;
          const hasCardChrome = Boolean(option.description);

          const labelClasses = hasCardChrome
            ? `flex flex-1 min-w-48 flex-col gap-1 rounded-card border p-4 cursor-pointer transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-disabled:opacity-50 peer-disabled:pointer-events-none ${
                isSelected ? CARD_TONE_CLASSES[tone] : 'border-secondary-light/40'
              }`
            : 'inline-flex items-center gap-2 cursor-pointer peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 rounded-control peer-disabled:opacity-50 peer-disabled:pointer-events-none';

          return (
            <div key={option.value} className={hasCardChrome ? 'flex flex-1 min-w-48' : ''}>
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
              <label htmlFor={inputId} className={labelClasses}>
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`size-4 shrink-0 rounded-full border-2 flex items-center justify-center ${
                      isSelected ? 'border-secondary' : 'border-secondary-light'
                    }`}
                  >
                    {isSelected ? <span className="size-2 rounded-full bg-secondary" /> : null}
                  </span>
                  <span className="text-body font-semibold text-secondary">{option.title}</span>
                </span>
                {option.description ? (
                  <span className="text-small text-secondary-light pl-6">{option.description}</span>
                ) : null}
              </label>
            </div>
          );
        })}
      </div>

      {selected?.content ? (
        <div className="pl-6">
          <Card tone={tone}>{selected.content}</Card>
        </div>
      ) : null}
    </div>
  );
}
