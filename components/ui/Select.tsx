'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDownIcon, CheckIcon } from './Icons';

export type SelectOption = { value: string; label: string };

/**
 * A hand-rolled listbox, not a native <select>. This is a deliberate,
 * higher-effort choice: the reference image shows the open dropdown with
 * its currently-selected option highlighted in a specific brand color
 * (secondary-light), which native <select> option styling cannot reliably
 * reproduce across browsers (Windows renders native <select> popups with
 * the OS's own theme, ignoring most CSS entirely).
 *
 * Because we're opting out of native <select> semantics, we have to
 * hand-build the accessibility behavior a native element would give for
 * free:
 *  - `role="combobox"` trigger button + `aria-expanded` + `aria-controls`
 *  - `role="listbox"` popup with `role="option"` children + `aria-selected`
 *  - `aria-activedescendant` on the trigger, pointing at the keyboard-
 *    highlighted option, so a screen reader announces the highlight
 *    without moving actual DOM focus off the trigger (the standard pattern
 *    for a "managed focus" listbox)
 *  - ArrowUp/ArrowDown to move the highlight, Enter/Space to choose it,
 *    Escape to close, and a document-level click listener to close on an
 *    outside click.
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

  // Click-outside-to-close: a plain document listener, no library. Only
  // attached while open, and cleaned up on close/unmount.
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
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      <label htmlFor={fieldId} className="text-small font-semibold text-secondary">
        {label}
      </label>
      <div className="relative">
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
          className={`w-full flex items-center justify-between gap-2 bg-white border rounded-control px-4 py-2.5 text-body text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:pointer-events-none ${
            error ? 'border-red-600' : 'border-accent/40'
          }`}
        >
          <span className={selected ? 'text-secondary' : 'text-accent'}>{selected ? selected.label : placeholder}</span>
          <ChevronDownIcon className={`size-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open ? (
          <ul id={listboxId} role="listbox" aria-labelledby={fieldId} className="absolute z-10 mt-1 w-full rounded-control border border-accent/40 bg-white py-1 shadow-md max-h-64 overflow-auto">
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
                  className={`flex items-center justify-between gap-2 px-4 py-2 text-body cursor-pointer ${
                    isSelected ? 'bg-secondary-light/30 font-semibold' : isActive ? 'bg-secondary-light/10' : ''
                  }`}
                >
                  {option.label}
                  {isSelected ? <CheckIcon className="size-4 text-secondary" /> : null}
                </li>
              );
            })}
          </ul>
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
}
