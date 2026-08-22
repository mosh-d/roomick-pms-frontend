'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { XIcon, PlusIcon, CheckIcon } from './Icons';
import type { SelectOption } from './Select';

/**
 * One component, not two, covering both behaviors the reference image
 * shows: a dropdown-constrained multi-select (pick from `options` only,
 * with checkmarks for already-chosen values — see the "Applies to"
 * field in the reference's Tax Rule Builder) and a free-text tag input
 * (type anything, hit Add/Enter — see "Views"/"Amenities"). The
 * `allowCustom` prop switches between them rather than shipping two
 * near-duplicate components.
 *
 * Matches Select.tsx's inline (not floating) open-list pattern and its
 * `bg-secondary-light/15` open-state box, for the same reasons — see that
 * file's header comment.
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

  function toggleTag(tagValue: string) {
    if (value.includes(tagValue)) onChange(value.filter((v) => v !== tagValue));
    else onChange([...value, tagValue]);
  }

  function removeTag(tagValue: string) {
    onChange(value.filter((v) => v !== tagValue));
  }

  function addCustomTag(tagValue: string) {
    const trimmed = tagValue.trim();
    if (!trimmed || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
  }

  function handleDraftKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      addCustomTag(draft);
      setDraft('');
    }
  }

  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;

  return (
    <div
      ref={containerRef}
      className={`flex flex-col gap-1 rounded-control px-3 -mx-3 py-2 transition-colors ${open ? 'bg-secondary-light/15' : ''}`}
    >
      <label id={`${fieldId}-label`} htmlFor={fieldId} className="text-small font-semibold text-secondary">
        {label}
      </label>

      {/* Chips row — every selected value, regardless of which mode added it. */}
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mb-1">
          {value.map((tagValue) => (
            <span
              key={tagValue}
              className="inline-flex items-center gap-1 rounded-pill bg-secondary-light/30 px-3 py-1 text-small text-secondary"
            >
              {labelFor(tagValue)}
              <button
                type="button"
                onClick={() => removeTag(tagValue)}
                aria-label={`Remove ${labelFor(tagValue)}`}
                className="text-secondary-light hover:text-secondary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full"
              >
                <XIcon className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {allowCustom ? (
        // Free-text mode: underline field + Add button/Enter-to-add,
        // matching Input.tsx's field anatomy.
        <div className="flex items-end gap-3">
          <input
            id={fieldId}
            name={name}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleDraftKeyDown}
            placeholder="Text Input..."
            aria-describedby={errorId ?? hintId}
            className={`flex-1 bg-transparent border-0 border-b pb-1 text-body placeholder:text-accent focus:outline-none ${
              error ? 'border-red-600' : 'border-accent/40 focus:border-secondary'
            }`}
          />
          <button
            type="button"
            onClick={() => {
              addCustomTag(draft);
              setDraft('');
            }}
            className="inline-flex items-center gap-1 pb-1 text-body font-semibold text-primary-text hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-control"
          >
            <PlusIcon className="size-4" /> Add
          </button>
        </div>
      ) : (
        // Dropdown-constrained mode: underline trigger + inline checklist
        // (checkmarks toggle membership, chips above are the source of
        // truth for what's selected).
        <button
          type="button"
          id={fieldId}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={`${fieldId}-label`}
          onClick={() => setOpen((o) => !o)}
          aria-describedby={errorId ?? hintId}
          className={`w-full flex items-center justify-between gap-2 bg-transparent border-0 border-b pb-1 text-body text-left text-accent cursor-pointer focus:outline-none ${
            error ? 'border-red-600' : open ? 'border-secondary' : 'border-accent/40'
          }`}
        >
          Tick an option
        </button>
      )}

      {!allowCustom && open ? (
        <ul role="listbox" className="mt-1 flex flex-col max-h-64 overflow-auto">
          {options.map((option) => {
            const isSelected = value.includes(option.value);
            return (
              <li
                key={option.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => toggleTag(option.value)}
                className={`flex items-center justify-between gap-2 rounded-control px-3 py-2 text-body cursor-pointer ${
                  isSelected ? 'bg-secondary-light text-secondary font-semibold' : 'hover:bg-secondary-light/30'
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
        <p id={hintId} className="text-small text-secondary-light mt-1">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
