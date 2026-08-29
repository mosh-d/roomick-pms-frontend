'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useExtendStayMutation } from '@/lib/reservations';
import { dayAfter } from '@/lib/dates';
import { ApiError } from '@/lib/api';

/** ISO date -> the plain `YYYY-MM-DD` a `type="date"` input needs. */
function toDateInput(iso: string): string {
  return iso.slice(0, 10);
}

export type ExtendStayTarget = { id: string; guestName: string; checkOutDate: string };

/**
 * Shared "extend stay" flow for a checked-in guest — opened from both the
 * In-House Guest List (see when a guest is due out) and the Departures
 * Dashboard (a guest at the desk decides to stay longer). Backs onto
 * `ReservationsService.extendStay`, which only accepts a `checked_in`
 * reservation and re-resolves the rate over the FULL new stay — never just
 * appends a flat per-night amount — so the confirmed total shown elsewhere
 * (folio, guest list) stays correct after the change.
 */
export function ExtendStayDialog({
  target,
  branchId,
  auth,
  onClose,
}: {
  target: ExtendStayTarget | null;
  branchId: string;
  auth: { accessToken: string | undefined; tenantId: string | undefined };
  onClose: () => void;
}) {
  const [checkOutDate, setCheckOutDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const extendStayMutation = useExtendStayMutation(branchId, auth);

  useEffect(() => {
    if (target) {
      setCheckOutDate(dayAfter(toDateInput(target.checkOutDate)));
      setError(null);
    }
  }, [target]);

  if (!target) return null;

  const minDate = dayAfter(toDateInput(target.checkOutDate));

  async function handleSubmit() {
    if (!target) return;
    setError(null);
    try {
      await extendStayMutation.mutateAsync({ reservationId: target.id, checkOutDate });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <Modal open title={`Extend ${target.guestName}'s stay`} onClose={onClose}>
      <p className="text-body text-secondary-light">
        Currently checked out on {new Date(target.checkOutDate).toLocaleDateString()}. Pick the new check-out date — the rate for the
        whole stay is re-resolved, so the total updates to match the extra night(s).
      </p>
      <Input
        label="New Check-Out Date"
        type="date"
        min={minDate}
        value={checkOutDate}
        onChange={(e) => setCheckOutDate(e.target.value)}
        error={error ?? undefined}
      />
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={extendStayMutation.isPending || !checkOutDate}>
          {extendStayMutation.isPending ? 'Extending…' : 'Extend Stay'}
        </Button>
      </div>
    </Modal>
  );
}
