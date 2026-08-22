'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDownIcon, CheckIcon, InfoCircleIcon } from './Icons';

export type SelectOption = { value: string; label: string };

/**
 * A hand-rolled listbox, not a native <select> — the reference product's
 * open-state look (options listed inline below the trigger, selected
 * option highlighted as a solid secondary-light bar, the whole group
 * boxed in a light tint while open) isn't reproducible on a native
 * <select> cross-browser.
 *
 * Two things changed from an earlier version of this component after
 * reviewing the actual product reference (Roomick-UI.pdf) closely:
 *  1. The trigger is an underline field (matches Input.tsx's anatomy),
 *     not a bordered box.
 *  2. The open listbox renders INLINE, in normal document flow — not as
 *     an absolutely-positioned floating popover. The reference shows
 *     content below a Select visibly pushed down while it's open, not
 *     covered by an overlay; matching that means no z-index/positioning
 *     concerns at all, which is also simply less code.
 *
 * Accessibility: `role="combobox"` trigger + `aria-expanded`/
 * `aria-controls`, `role="listbox"` + `role="option"` children,
 * `aria-activedescendant` on the trigger (managed-focus pattern — DOM
 * focus stays on the trigger the whole time; the "active" option is
 * announced via aria-activedescendant, not by moving real focus), full
 * Arrow/Enter/Escape keyboard support, click-outside-to-close.
 */
export function Select({
  label,
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  hint,
  error,
  disabled = false,
  name,
  id,
}: {
  label: string;
  options: SelectOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  name?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, options.findIndex((o) => o.value === value)));
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const fieldId = id ?? name ?? 'select';
  const listboxId = `${fieldId}-listbox`;
  const selected = options.find((o) => o.value === value) ?? null;

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function openAt(index: number) {
    setActiveIndex(Math.min(Math.max(index, 0), options.length - 1));
    setOpen(true);
  }

  function commitActive() {
    const option = options[activeIndex];
    if (option) onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!open) openAt(Math.max(0, options.findIndex((o) => o.value === value)));
        else setActiveIndex((i) => Math.min(i + 1, options.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!open) openAt(Math.max(0, options.findIndex((o) => o.value === value)));
        else setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (open) commitActive();
        else openAt(Math.max(0, options.findIndex((o) => o.value === value)));
        break;
      case 'Escape':
        if (open) {
          event.preventDefault();
          setOpen(false);
        }
        break;
    }
  }

  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;

  return (
    <div
      ref={containerRef}
      className={`flex flex-col gap-1 rounded-control px-3 -mx-3 py-2 transition-colors ${open ? 'bg-secondary-light/15' : ''}`}
    >
      <label htmlFor={fieldId} className="text-small font-semibold text-secondary">
        {label}
      </label>
      <button
        ref={triggerRef}
        type="button"
        id={fieldId}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open ? `${listboxId}-option-${activeIndex}` : undefined}
        aria-describedby={errorId ?? hintId}
        aria-invalid={Boolean(error)}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openAt(Math.max(0, options.findIndex((o) => o.value === value))))}
        onKeyDown={handleTriggerKeyDown}
        className={`w-full flex items-center justify-between gap-2 bg-transparent border-0 border-b pb-1 text-body text-left cursor-pointer focus:outline-none disabled:opacity-50 disabled:pointer-events-none disabled:cursor-default ${
          error ? 'border-red-600' : open ? 'border-secondary' : 'border-accent/40'
        }`}
      >
        <span className={selected ? 'text-secondary' : 'text-accent'}>{selected ? selected.label : placeholder}</span>
        <ChevronDownIcon className={`size-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <ul id={listboxId} role="listbox" aria-labelledby={fieldId} className="mt-1 flex flex-col max-h-64 overflow-auto">
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isActive = index === activeIndex;
            return (
              <li
                key={option.value}
                id={`${listboxId}-option-${index}`}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                className={`flex items-center justify-between gap-2 rounded-control px-3 py-2 text-body cursor-pointer ${
                  isSelected ? 'bg-secondary-light text-secondary font-semibold' : isActive ? 'bg-secondary-light/30' : ''
                }`}
              >
                {option.label}
                {isSelected ? <CheckIcon className="size-4" /> : null}
              </li>
            );
          })}
        </ul>
      ) : null}

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
}
