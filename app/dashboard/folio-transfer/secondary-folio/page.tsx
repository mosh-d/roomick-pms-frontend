'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { CreateSecondaryFolioIcon } from '@/components/ui/Icons';
import { ApiError } from '@/lib/api';
import { useCreateFolioMutation, useReservationFoliosQuery } from '@/lib/folios';
import { useReservationsQuery, type ReservationSummary } from '@/lib/reservations';
import { useCorporateAccountsQuery } from '@/lib/corporateAccounts';
import { formatMoney } from '@/lib/numberFormat';
import { currencySymbolFor } from '@/lib/currencies';
import { useAuthStore } from '@/lib/store/authStore';

const TAB_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Create Secondary Folio (ref: "Guest requests split e.g. personal vs
 * business") — a second bill on a booked or in-house stay, named, with who
 * pays it and the company it goes to. The stay's bills show as its folio
 * tabs (A, B, …) — A is the main bill every stay has; each opens on its own
 * page, and charges move onto a new one from Transfer Charges or Split
 * Billing.
 */
export default function CreateSecondaryFolioPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const [search, setSearch] = useState('');
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [payerName, setPayerName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const inHouseQuery = useReservationsQuery(activeBranchId, { status: 'checked_in' }, auth);
  const bookedQuery = useReservationsQuery(activeBranchId, { status: 'confirmed' }, auth);
  const accountsQuery = useCorporateAccountsQuery(auth);
  const foliosQuery = useReservationFoliosQuery(reservationId, auth);
  const createMutation = useCreateFolioMutation(activeBranchId ?? '', reservationId ?? '', auth);

  const stays: ReservationSummary[] = useMemo(() => [...(inHouseQuery.data ?? []), ...(bookedQuery.data ?? [])], [inHouseQuery.data, bookedQuery.data]);
  const stayOptions: SelectOption[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stays
      .filter((r) => !q || [r.guest.name, r.room?.number ?? '', r.confirmationNumber].some((v) => v.toLowerCase().includes(q)))
      .map((r) => ({
        value: r.id,
        label: `${r.guest.name}${r.room ? ` — Room ${r.room.number}` : ''} · ${r.confirmationNumber}${r.status === 'confirmed' ? ' (arriving)' : ''}`,
      }));
  }, [stays, search]);
  const stay = stays.find((r) => r.id === reservationId) ?? null;
  const companyOptions: SelectOption[] = useMemo(
    () => [{ value: '', label: 'None' }, ...(accountsQuery.data ?? []).filter((a) => a.isActive).map((a) => ({ value: a.id, label: a.name }))],
    [accountsQuery.data],
  );
  const symbol = currencySymbolFor(stay?.branch.currency);

  function pickStay(id: string) {
    setReservationId(id);
    setNotice(null);
    setError(null);
  }

  async function handleCreate() {
    if (!reservationId || !label.trim()) return;
    setError(null);
    setNotice(null);
    try {
      const created = await createMutation.mutateAsync({
        label: label.trim(),
        payerName: payerName.trim() || undefined,
        corporateAccountId: companyId || undefined,
      });
      setNotice(`Opened "${created.label ?? label.trim()}" on this stay. Move charges onto it from Transfer Charges.`);
      setLabel('');
      setPayerName('');
      setCompanyId('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not open the bill.');
    }
  }

  if (!activeBranchId) return null;

  return (
    <Container className="max-w-4xl py-10 flex flex-col gap-8">
      <PageHeader
        icon={<CreateSecondaryFolioIcon className="size-8" />}
        title="Create Secondary Folio"
        subtitle="A second bill on a stay — personal and business, guest and company."
        roles="Front Desk · Accountant"
      />

      {error ? <p className="text-small text-red-600">{error}</p> : null}
      {notice ? (
        <Card tone="secondary">
          <p className="text-small text-surface">{notice}</p>
        </Card>
      ) : null}

      <Section label="Stay">
        <SearchInput label="Search stays" placeholder="Guest, room or confirmation #" value={search} onChange={setSearch} />
        <Select id="secondary-folio-stay" name="reservationId" label="Stay" options={stayOptions} value={reservationId} onChange={pickStay} hint="Guests in the house, and bookings still to arrive" />
      </Section>

      {stay ? (
        <>
          <Section label="Its Bills">
            {foliosQuery.isLoading ? (
              <p className="text-body text-surface-muted">Loading…</p>
            ) : (foliosQuery.data ?? []).length === 0 ? (
              <p className="text-body text-surface-muted">No bills yet — the main bill opens at check-in. A secondary one can be opened now.</p>
            ) : (
              <div className="flex flex-wrap gap-3" role="list" aria-label="Folio tabs">
                {(foliosQuery.data ?? []).map((folio, index) => (
                  <Link
                    key={folio.id}
                    href={`/dashboard/billing/${folio.id}`}
                    role="listitem"
                    className="flex min-w-48 flex-col gap-1 rounded-card border border-primary/25 bg-white px-4 py-3 hover:border-primary"
                  >
                    <span className="text-small font-bold text-surface">
                      {TAB_LETTERS[index] ?? index + 1} · {folio.label ?? 'Main bill'}
                    </span>
                    <span className="text-tiny text-surface-muted">
                      {[folio.payerName ? `Paid by ${folio.payerName}` : null, folio.corporateAccount?.name ?? null].filter(Boolean).join(' · ') || 'The guest'}
                    </span>
                    <span className="text-small text-surface">
                      {folio.status === 'settled' ? 'Settled' : `Owes ${formatMoney(folio.balanceDue, symbol)}`}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Section>

          <Section label="New Bill">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              <Input label="Folio name" name="label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={100} hint="e.g. Business, Company, Personal" />
              <Input label="Paid by (optional)" name="payerName" value={payerName} onChange={(e) => setPayerName(e.target.value)} maxLength={200} hint="When it isn't the guest" />
              <Select id="secondary-folio-company" name="corporateAccountId" label="Company (optional)" options={companyOptions} value={companyId} onChange={setCompanyId} hint="The company account this bill goes to" />
            </div>
            <Button type="button" onClick={handleCreate} disabled={!label.trim()} loading={createMutation.isPending} className="self-start">
              Open Folio
            </Button>
          </Section>
        </>
      ) : null}
    </Container>
  );
}
