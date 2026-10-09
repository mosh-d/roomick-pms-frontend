'use client';

import { useState } from 'react';
import { Section } from '@/components/ui/Section';
import { MultiSelectTagInput } from '@/components/ui/MultiSelectTagInput';
import { Button } from '@/components/ui/Button';
import { ApiError } from '@/lib/api';
import { formatMoney } from '@/lib/numberFormat';
import { currencySymbolFor } from '@/lib/currencies';
import { BASIS_LABELS, usePackagesQuery, useSetStayPackagesMutation } from '@/lib/packages';
import type { ReservationSummary } from '@/lib/reservations';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((id) => b.includes(id));

/**
 * A stay's packages, changed after booking. One already on the stay keeps the
 * price it was added at — including one no longer on sale, which stays
 * listed until it's taken off. One added to a stay under way is charged from
 * today, never for the nights already past. Mount with `key={reservation.id}`.
 */
export function StayPackagesEditor({
  reservation,
  branchId,
  auth,
  showWhenNone = false,
}: {
  reservation: ReservationSummary;
  branchId: string;
  auth: AuthOpts;
  /** Says so when nothing is on sale for the room type, instead of showing nothing. */
  showWhenNone?: boolean;
}) {
  const packagesQuery = usePackagesQuery(branchId, auth);
  const mutation = useSetStayPackagesMutation(reservation.id, auth);
  const current = (reservation.packages ?? []).map((p) => p.packageId);
  const [picked, setPicked] = useState<string[]>(current);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const symbol = currencySymbolFor(reservation.branch.currency);

  const onSale = (packagesQuery.data ?? []).filter((p) => p.isActive && (p.roomTypeIds.length === 0 || p.roomTypeIds.includes(reservation.roomType.id)));
  const options = [
    ...onSale.map((p) => ({ value: p.id, label: `${p.name} — ${formatMoney(p.price, symbol)} ${BASIS_LABELS[p.basis]}` })),
    // On the stay at the price it was added at, though no longer on sale.
    ...(reservation.packages ?? [])
      .filter((s) => !onSale.some((p) => p.id === s.packageId))
      .map((s) => ({ value: s.packageId, label: `${s.name} — ${formatMoney(s.price, symbol)} ${BASIS_LABELS[s.basis]} (no longer sold)` })),
  ];
  if (options.length === 0) {
    if (!showWhenNone || packagesQuery.isLoading) return null;
    return <p className="text-body text-surface-muted">No packages are on sale for a {reservation.roomType.name}. Managers add them on the Rate Resolver page.</p>;
  }

  async function save() {
    setError(null);
    setSaved(false);
    try {
      await mutation.mutateAsync(picked);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <Section label="Packages">
      <MultiSelectTagInput
        id={`stay-packages-${reservation.id}`}
        label="Packages on this stay"
        options={options}
        value={picked}
        onChange={(ids) => {
          setPicked(ids);
          setSaved(false);
        }}
        hint={
          reservation.status === 'checked_in'
            ? 'One added now is charged from tonight. One taken off stops; what was already charged stays on the bill.'
            : 'Each posts to the bill as its own charge, with the nights it goes with.'
        }
      />
      {error ? <p className="text-small text-red-600">{error}</p> : null}
      {saved ? <p className="text-small font-semibold text-surface">Packages saved.</p> : null}
      <Button type="button" size="sm" className="self-start" loading={mutation.isPending} disabled={sameSet(picked, current)} onClick={save}>
        Save Packages
      </Button>
    </Section>
  );
}
