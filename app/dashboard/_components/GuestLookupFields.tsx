'use client';

import { useRef, useState, type ChangeEvent, type FocusEvent, type KeyboardEvent } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { Input } from '@/components/ui/Input';
import { StatusTag } from '@/components/ui/StatusTag';
import { useGuestSearchQuery, type GuestMatch } from '@/lib/guests';

type Field = 'name' | 'email' | 'phone';

const LABELS: Record<Field, string> = { name: 'Name', email: 'Email', phone: 'Phone' };

/** What a field has to hold before it's worth searching on: a few letters, or for a phone four digits (the backend's own floor). */
function searchable(field: Field, value: string): string {
  const term = value.trim();
  if (field === 'phone') return term.replace(/[^0-9]/g, '').length >= 4 ? term : '';
  return term.length >= 2 ? term : '';
}

/**
 * The guest's name, email and phone, with returning guests offered as you
 * type: whichever field you're in is searched (name, email, or phone —
 * however the number was typed), and the matches drop down under it. Pick
 * one and the booking goes on that guest's existing profile instead of
 * creating a second one; "Not this guest" goes back to a new one.
 *
 * The fields themselves stay the form's own (`register`) — this only adds
 * the lookup around them, so Walk-In Booking and Create Reservation each
 * keep their own validation.
 */
export function GuestLookupFields({
  fields,
  errors,
  linkedGuest,
  onLink,
  onUnlink,
  auth,
}: {
  fields: Record<Field, UseFormRegisterReturn>;
  errors: Partial<Record<Field, string>>;
  linkedGuest: GuestMatch | null;
  onLink: (guest: GuestMatch) => void;
  onUnlink: () => void;
  auth: { accessToken: string | undefined; tenantId: string | undefined };
}) {
  const [active, setActive] = useState<Field | null>(null);
  const [term, setTerm] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchQuery = useGuestSearchQuery(linkedGuest ? '' : term, auth);
  const matches = searchQuery.data ?? [];
  const showList = !linkedGuest && !dismissed && active !== null && term !== '' && matches.length > 0;

  function typed(field: Field, value: string) {
    setActive(field);
    setDismissed(false);
    setHighlight(0);
    // A quarter-second pause before searching, so a fast typist isn't firing a request per letter.
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setTerm(searchable(field, value)), 250);
  }

  function pick(guest: GuestMatch) {
    setDismissed(true);
    setTerm('');
    onLink(guest);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!showList) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((i) => (i + 1) % matches.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((i) => (i - 1 + matches.length) % matches.length);
    } else if (event.key === 'Enter') {
      // Picking the highlighted guest, not submitting the booking.
      event.preventDefault();
      const guest = matches[highlight];
      if (guest) pick(guest);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setDismissed(true);
    }
  }

  const listId = 'guest-lookup-matches';

  function field(name: Field, type?: string) {
    const registered = fields[name];
    const open = showList && active === name;
    return (
      <div className="relative">
        <Input
          label={LABELS[name]}
          type={type}
          {...registered}
          autoComplete="off"
          readOnly={linkedGuest !== null}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open ? `${listId}-${highlight}` : undefined}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            void registered.onChange(event);
            typed(name, event.target.value);
          }}
          onBlur={(event: FocusEvent<HTMLInputElement>) => {
            void registered.onBlur(event);
            // Let a click on a suggestion land before the list goes.
            setTimeout(() => setActive((current) => (current === name ? null : current)), 150);
          }}
          onKeyDown={onKeyDown}
          error={errors[name]}
        />
        {open ? (
          <ul
            id={listId}
            role="listbox"
            aria-label="Returning guests"
            className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-card border border-secondary/20 bg-white py-1 shadow-lg"
          >
            {matches.map((guest, index) => (
              <li
                key={guest.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === highlight}
                // mousedown, not click: it fires before the field's blur closes the list.
                onMouseDown={(event) => {
                  event.preventDefault();
                  pick(guest);
                }}
                onMouseEnter={() => setHighlight(index)}
                className={`flex flex-col gap-0.5 px-3 py-2 cursor-pointer ${index === highlight ? 'bg-secondary/10' : ''}`}
              >
                <span className="flex items-center gap-2 text-small font-semibold text-surface">
                  {guest.name}
                  {guest.vipLevel ? <StatusTag value="vip" /> : null}
                </span>
                <span className="text-tiny text-surface-muted">{[guest.phone, guest.email].filter(Boolean).join(' · ') || 'No phone or email on file'}</span>
              </li>
            ))}
            <li role="presentation" className="px-3 pt-1.5 pb-1 text-tiny text-surface-muted border-t border-secondary/10 mt-1">
              Not listed? Keep typing — a new guest is added with the booking.
            </li>
          </ul>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {linkedGuest ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-secondary/20 bg-secondary/5 px-3 py-2">
          <p className="text-small text-surface">
            <span className="font-semibold">Returning guest:</span> {linkedGuest.name} — this booking goes on their existing profile. Change their details from
            Guest Profiles.
          </p>
          <button type="button" onClick={onUnlink} className="text-small font-semibold text-surface underline underline-offset-2 cursor-pointer">
            Not this guest
          </button>
        </div>
      ) : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        {field('name')}
        {field('email', 'email')}
        {field('phone')}
      </div>
    </div>
  );
}
