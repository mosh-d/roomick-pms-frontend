'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { XIcon, PlusIcon } from './Icons';
import type { SelectOption } from './Select';

/**
 * One component, not two, covering both behaviors the reference image
 * shows: a dropdown-constrained multi-select (pick from `options` only)
 * and a free-text tag input (type anything, hit Add/Enter). The
 * `allowCustom` prop switches between them rather than shipping two
 * near-duplicate components — the reuse-over-duplication call documented
 * in design-system/04-components/forms.md.
 */
export function MultiSelectTagInput({
  label,
  options,
  value,
  onChange,
  allowCustom = false,
  hint,
  error,
  name,
  id,
}: {
  label: string;
  options: SelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  allowCustom?: boolean;
  hint?: string;
  error?: string;
  name?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const fieldId = id ?? name ?? 'multi-select';

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

  function labelFor(tagValue: string) {
    return options.find((o) => o.value === tagValue)?.label ?? tagValue;
  }

  function removeTag(tagValue: string) {
    onChange(value.filter((v) => v !== tagValue));
  }

  function addTag(tagValue: string) {
    const trimmed = tagValue.trim();
    if (!trimmed || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
  }

  function handleDraftKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      addTag(draft);
      setDraft('');
    }
  }

  // Options not already chosen — the dropdown-constrained mode's list.
  const remainingOptions = options.filter((o) => !value.includes(o.value));

  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      <label id={`${fieldId}-label`} className="text-small font-semibold text-secondary">
        {label}
      </label>

      {/* Chips row — every selected value, regardless of which mode added it. */}
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tagValue) => (
            <span
              key={tagValue}
              className="inline-flex items-center gap-1 rounded-pill bg-secondary/10 px-3 py-1 text-small text-secondary"
            >
              {labelFor(tagValue)}
              <button
                type="button"
                onClick={() => removeTag(tagValue)}
                aria-label={`Remove ${labelFor(tagValue)}`}
                className="text-secondary-light hover:text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full"
              >
                <XIcon className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {allowCustom ? (
        // Free-text mode: a plain text field + Add button/Enter-to-add.
        <div className="flex gap-2">
          <input
            id={fieldId}
            name={name}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleDraftKeyDown}
            placeholder="Text Input..."
            aria-describedby={errorId ?? hintId}
            className={`flex-1 bg-white border rounded-control px-4 py-2.5 text-body placeholder:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              error ? 'border-red-600' : 'border-accent/40'
            }`}
          />
          <button
            type="button"
            onClick={() => {
              addTag(draft);
              setDraft('');
            }}
            className="inline-flex items-center gap-1 px-3 text-body font-semibold text-primary-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-control"
          >
            <PlusIcon className="size-4" /> Add
          </button>
        </div>
      ) : (
        // Dropdown-constrained mode: a trigger that opens a plain option
        // list of everything not already chosen. Reuses Select.tsx's
        // click-outside/listbox conventions at a smaller scale rather than
        // importing Select itself, since this list never needs Select's
        // keyboard-highlight/combobox machinery — every click immediately
        // commits (adds a chip) instead of "selecting" a single value.
        <div className="relative">
          <button
            type="button"
            id={fieldId}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-labelledby={`${fieldId}-label`}
            onClick={() => setOpen((o) => !o)}
            disabled={remainingOptions.length === 0}
            aria-describedby={errorId ?? hintId}
            className={`w-full flex items-center justify-between gap-2 bg-white border rounded-control px-4 py-2.5 text-body text-left text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 ${
              error ? 'border-red-600' : 'border-accent/40'
            }`}
          >
            Tick an option
          </button>
          {open ? (
            <ul role="listbox" className="absolute z-10 mt-1 w-full rounded-control border border-accent/40 bg-white py-1 shadow-md max-h-64 overflow-auto">
              {remainingOptions.map((option) => (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={false}
                  onClick={() => addTag(option.value)}
                  className="px-4 py-2 text-body cursor-pointer hover:bg-secondary-light/10"
                >
                  {option.label}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

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
