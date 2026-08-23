'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { XIcon, PlusIcon, CheckIcon, ChevronDownIcon } from './Icons';
import { SELECTED_OPTION_CLASSES, UNSELECTED_OPTION_CLASSES, type SelectOption } from './Select';

/**
 * One component, not two, covering both behaviors the reference image
 * shows: a dropdown-constrained multi-select (pick from `options` only,
 * with checkmarks for already-chosen values — see the "Applies to"
 * field in the reference's Tax Rule Builder) and a free-text tag input
 * (type anything, hit Add/Enter — see "Views"/"Amenities"). The
 * `allowCustom` prop switches which free-entry affordance is available,
 * not whether `options` shows at all — pass both `allowCustom` and a
 * non-empty `options` (as `RoomTypeForm`'s Amenities field does) to get
 * free text *and* a "pick from common options" list together; the picker
 * trigger only renders when `options` is actually non-empty either way, so
 * a pure free-text field (`options={[]}`) doesn't show a pointless empty
 * list. Caught directly: this field's own hint said "pick from common
 * amenities or type your own" while only the typing half actually worked —
 * `options` was accepted as a prop and used for chip labels, but never
 * rendered as anything pickable once `allowCustom` was true.
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
  formatTag,
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
  /** Normalizes a custom-typed tag before it's stored (e.g. `lib/textFormat.ts`'s `toTitleCase` — "king size" → "King Size") — never applied to `options`' own labels, which are already however they're meant to display. */
  formatTag?: (raw: string) => string;
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
    if (!trimmed) return;
    const formatted = formatTag ? formatTag(trimmed) : trimmed;
    if (value.includes(formatted)) return;
    onChange([...value, formatted]);
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
        // matching Input.tsx's field anatomy. hint/error are announced from
        // here (not the picker trigger below) — this is the field the
        // `label` is actually `htmlFor`-linked to.
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
      ) : null}

      {/* Picker trigger — shown whenever there's actually a predefined
          list to pick from, in *both* modes. In pure dropdown mode
          (`!allowCustom`) this is the field's only control, so it owns the
          real `id`/label/hint/error wiring; in combined mode it's a second,
          supplementary control (the free-text input above already owns
          those), so it gets its own id and a plain `aria-label` instead of
          repeating the same hint/error a screen reader just heard once.
          Styled to match `Select.tsx`'s own trigger exactly (chevron,
          spacing, text color) — this *is* a dropdown trigger, not a
          secondary/muted hint, so it uses the same plain field text color
          every other interactive control does. `accent` is reserved for
          non-interactive detail/review cards elsewhere in this design
          system, never for text or borders on something clickable. */}
      {options.length > 0 ? (
        <button
          type="button"
          id={allowCustom ? `${fieldId}-picker` : fieldId}
          aria-haspopup="listbox"
          aria-expanded={open}
          {...(allowCustom
            ? { 'aria-label': `Pick ${label} from common options` }
            : { 'aria-labelledby': `${fieldId}-label`, 'aria-describedby': errorId ?? hintId })}
          onClick={() => setOpen((o) => !o)}
          className={`${allowCustom ? 'mt-3' : ''} w-full flex items-center justify-between gap-2 bg-transparent border-0 border-b pb-1 text-body text-left cursor-pointer focus:outline-none ${
            !allowCustom && error ? 'border-red-600' : open ? 'border-secondary' : 'border-accent/40'
          }`}
        >
          {allowCustom ? 'Pick from common options' : 'Tick an option'}
          <ChevronDownIcon
            className={`size-4 shrink-0 text-accent-dark pointer-events-none transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
      ) : null}

      {open && options.length > 0 ? (
        <ul role="listbox" className="mt-1 flex flex-col gap-1 max-h-64 overflow-auto">
          {options.map((option) => {
            const isSelected = value.includes(option.value);
            return (
              <li
                key={option.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => toggleTag(option.value)}
                className={`flex items-center justify-between gap-2 rounded-control px-3 py-2 text-body cursor-pointer ${
                  isSelected ? SELECTED_OPTION_CLASSES : UNSELECTED_OPTION_CLASSES
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
