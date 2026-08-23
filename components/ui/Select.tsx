'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDownIcon, CheckIcon, InfoCircleIcon } from './Icons';
import { FIELD_PLACEHOLDER_CLASS, FIELD_UNDERLINE_CLASS } from './Input';

export type SelectOption = { value: string; label: string };

/**
 * Shared listbox-option state classes — design-system level, not
 * per-component: `MultiSelectTagInput.tsx`'s own option list reuses these
 * directly rather than keeping a second, separately-tuned copy that could
 * drift out of sync with this one. `border` is present (transparent) on
 * the unselected state too, not just added when selected, so picking an
 * option doesn't shift the row's box size by the border's own width.
 */
export const SELECTED_OPTION_CLASSES = 'border border-secondary bg-secondary-light/20 text-secondary font-semibold';
export const UNSELECTED_OPTION_CLASSES = 'border border-transparent hover:bg-secondary-light/30';

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
 * The trigger is a real `<input>`, not a `<button>` — added once a
 * 195-entry country list made click-and-scroll the only way to pick
 * anything genuinely painful. Typing filters `options` by a case-
 * insensitive substring match on `label`, live. Opening the dropdown
 * (click, focus, or an arrow key) always starts the filter empty — it
 * doesn't pre-fill with the current selection — closing it (Escape,
 * selecting an option, clicking outside) reverts the field to showing
 * the selected option's label, same as before this was a text input.
 *
 * Accessibility: `role="combobox"` on the input itself + `aria-expanded`/
 * `aria-controls`, `role="listbox"` + `role="option"` children,
 * `aria-activedescendant` (managed-focus pattern — DOM focus stays on the
 * input the whole time; the "active" option is announced via
 * aria-activedescendant, not by moving real focus), full Arrow/Enter/
 * Escape keyboard support, click-outside-to-close.
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
  const [filterText, setFilterText] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fieldId = id ?? name ?? 'select';
  const listboxId = `${fieldId}-listbox`;
  const selected = options.find((o) => o.value === value) ?? null;
  const filteredOptions = filterText.trim()
    ? options.filter((option) => option.label.toLowerCase().includes(filterText.trim().toLowerCase()))
    : options;

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closeAndReset();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function openFresh() {
    setFilterText('');
    setActiveIndex(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }

  function closeAndReset() {
    setOpen(false);
    setFilterText('');
  }

  function commitActive() {
    const option = filteredOptions[activeIndex];
    if (option) onChange(option.value);
    closeAndReset();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!open) openFresh();
        else setActiveIndex((i) => Math.min(i + 1, filteredOptions.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!open) openFresh();
        else setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        event.preventDefault();
        if (open) commitActive();
        else openFresh();
        break;
      case 'Escape':
        if (open) {
          event.preventDefault();
          closeAndReset();
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
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          id={fieldId}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={open && filteredOptions[activeIndex] ? `${listboxId}-option-${activeIndex}` : undefined}
          aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
          aria-invalid={Boolean(error)}
          disabled={disabled}
          autoComplete="off"
          value={open ? filterText : (selected?.label ?? '')}
          placeholder={placeholder}
          onFocus={() => {
            if (!open) openFresh();
          }}
          onChange={(event) => {
            if (!open) setOpen(true);
            setFilterText(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
          className={`w-full bg-transparent border-0 border-b pb-1 pr-6 text-body ${FIELD_PLACEHOLDER_CLASS} focus:outline-none cursor-pointer disabled:opacity-50 disabled:pointer-events-none disabled:cursor-default ${
            error ? 'border-red-600' : open ? 'border-secondary' : FIELD_UNDERLINE_CLASS
          }`}
        />
        <ChevronDownIcon
          className={`absolute right-0 size-4 shrink-0 text-accent-dark pointer-events-none transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </div>

      {open ? (
        <ul id={listboxId} role="listbox" aria-labelledby={fieldId} className="mt-1 flex flex-col gap-1 max-h-64 overflow-auto">
          {filteredOptions.length === 0 ? (
            <li className="px-3 py-2 text-body text-secondary-light">No matches</li>
          ) : (
            filteredOptions.map((option, index) => {
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
                    closeAndReset();
                    inputRef.current?.focus();
                  }}
                  className={`flex items-center justify-between gap-2 rounded-control px-3 py-2 text-body cursor-pointer ${
                    isSelected ? SELECTED_OPTION_CLASSES : isActive ? 'border border-transparent bg-secondary-light/30' : UNSELECTED_OPTION_CLASSES
                  }`}
                >
                  {option.label}
                  {isSelected ? <CheckIcon className="size-4" /> : null}
                </li>
              );
            })
          )}
        </ul>
      ) : null}

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
}
