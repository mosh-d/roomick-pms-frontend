'use client';

import { useMemo, useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Table, type TableColumn } from '@/components/ui/Table';
import { RatePlanIcon } from '@/components/ui/Icons';
import { useRatePlansQuery, useCreateRatePlanMutation, useUpdateRatePlanMutation, type RatePlan, type RateType, type AdjustmentType } from '@/lib/rate-resolver';
import { useRoomTypesQuery } from '@/lib/rooms';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';

const TYPE_OPTIONS: SelectOption[] = [
  { value: 'base', label: 'Base' },
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'weekend', label: 'Weekend' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'negotiated', label: 'Negotiated' },
  { value: 'promotional', label: 'Promotional' },
];
/** Mirrors `RateResolverService.createRatePlan`'s own validation — negotiated/promotional REPLACE the rate outright (no delta), so the Adjustment field is meaningless for them, not just optional. */
const OVERRIDE_TYPES: RateType[] = ['negotiated', 'promotional'];
const ADJUSTMENT_OPTIONS: SelectOption[] = [
  { value: 'fixed', label: 'Fixed amount' },
  { value: 'percentage', label: 'Percentage' },
];

function typeLabel(type: RateType): string {
  return TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

/**
 * Rate Plan Management (ref: Reservations hub's own card, inert since
 * Phase 30 pending the Rate Resolver) — create the base/seasonal/weekend/
 * corporate cascade tiers and negotiated/promotional overrides the
 * resolver applies on every booking screen. `cascadeTier` itself is never
 * shown or editable here — the backend derives it from `type` alone (see
 * `CASCADE_TIER_BY_TYPE`), so there's nothing for this form to set.
 */
export default function RatePlansPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const [roomTypeId, setRoomTypeId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<string | null>(null);
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [minLOS, setMinLOS] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const roomTypesQuery = useRoomTypesQuery(activeBranchId, auth);
  const ratePlansQuery = useRatePlansQuery(activeBranchId, auth);
  const createMutation = useCreateRatePlanMutation(activeBranchId ?? '', auth);
  const updateMutation = useUpdateRatePlanMutation(activeBranchId ?? '', auth);

  const roomTypeOptions: SelectOption[] = useMemo(
    () => [{ value: '', label: 'All Room Types' }, ...(roomTypesQuery.data ?? []).map((rt) => ({ value: rt.id, label: rt.name }))],
    [roomTypesQuery.data],
  );
  const roomTypeNameById = useMemo(() => new Map((roomTypesQuery.data ?? []).map((rt) => [rt.id, rt.name])), [roomTypesQuery.data]);

  const isOverrideType = type !== null && OVERRIDE_TYPES.includes(type as RateType);

  if (!activeBranchId) return null;

  async function submit() {
    if (!type || !name.trim() || !amount) return;
    if (!isOverrideType && !adjustmentType) {
      setFormError('Adjustment type is required for base/seasonal/weekend/corporate plans.');
      return;
    }
    if (type === 'promotional' && !promoCode.trim()) {
      setFormError('Promo code is required for a promotional plan.');
      return;
    }
    setFormError(null);
    try {
      await createMutation.mutateAsync({
        roomTypeId: roomTypeId || undefined,
        name: name.trim(),
        type: type as RateType,
        amount: Number(amount),
        adjustmentType: isOverrideType ? undefined : (adjustmentType as AdjustmentType),
        validFrom: validFrom || undefined,
        validTo: validTo || undefined,
        minLOS: minLOS ? Number(minLOS) : undefined,
        promoCode: type === 'promotional' ? promoCode.trim() : undefined,
      });
      setRoomTypeId(null);
      setName('');
      setType(null);
      setAmount('');
      setAdjustmentType(null);
      setValidFrom('');
      setValidTo('');
      setMinLOS('');
      setPromoCode('');
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  }

  const columns: TableColumn<RatePlan>[] = [
    { key: 'name', label: 'Name', render: (p) => p.name, sortValue: (p) => p.name },
    { key: 'type', label: 'Type', render: (p) => typeLabel(p.type), sortValue: (p) => p.type },
    { key: 'roomType', label: 'Room Type', render: (p) => (p.roomTypeId ? (roomTypeNameById.get(p.roomTypeId) ?? '—') : 'All Room Types') },
    {
      key: 'amount',
      label: 'Amount',
      render: (p) => (p.isOverride ? p.amount : `${p.amount}${p.adjustmentType === 'percentage' ? '%' : ''}`),
      align: 'right',
    },
    {
      key: 'valid',
      label: 'Valid',
      render: (p) => (p.validFrom || p.validTo ? `${p.validFrom ?? '…'} – ${p.validTo ?? '…'}` : 'Always'),
    },
    {
      key: 'status',
      label: 'Status',
      render: (p) => (
        <span
          className={`inline-flex items-center rounded-pill px-3 py-1 text-small font-semibold ${
            p.isActive ? 'bg-status-clean text-white' : 'border border-secondary/30 text-secondary-light'
          }`}
        >
          {p.isActive ? 'Active' : 'Retired'}
        </span>
      ),
    },
    {
      key: 'action',
      label: '',
      render: (p) => (
        <Button size="sm" variant="outline" loading={updateMutation.isPending} onClick={() => updateMutation.mutate({ ratePlanId: p.id, isActive: !p.isActive })}>
          {p.isActive ? 'Retire' : 'Reactivate'}
        </Button>
      ),
    },
  ];

  return (
    <Container className="max-w-5xl py-10 flex flex-col gap-8">
      <PageHeader icon={<RatePlanIcon className="size-8" />} title="Rate Plan Management" subtitle="Base, seasonal, weekend, corporate, negotiated, promotional" />

      {formError ? <p className="text-small text-red-600">{formError}</p> : null}

      <Section label="Create Rate Plan">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
          <Select name="type" label="Type" options={TYPE_OPTIONS} value={type} onChange={setType} />
          <Select name="roomTypeId" label="Room Type" options={roomTypeOptions} value={roomTypeId} onChange={setRoomTypeId} />
          <Input name="name" label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Summer Weekend" />
          <Input name="amount" label={isOverrideType ? 'Nightly Rate' : 'Amount'} type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
          {!isOverrideType ? <Select name="adjustmentType" label="Adjustment Type" options={ADJUSTMENT_OPTIONS} value={adjustmentType} onChange={setAdjustmentType} /> : null}
          {type === 'promotional' ? <Input name="promoCode" label="Promo Code" value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())} /> : null}
          <Input name="validFrom" label="Valid From" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
          <Input name="validTo" label="Valid To" type="date" min={validFrom || undefined} value={validTo} onChange={(e) => setValidTo(e.target.value)} />
          <Input name="minLOS" label="Min. Nights" type="number" min={1} value={minLOS} onChange={(e) => setMinLOS(e.target.value)} />
        </div>
        <Button type="button" disabled={!type || !name.trim() || !amount} loading={createMutation.isPending} onClick={submit} className="self-start">
          Create Rate Plan
        </Button>
      </Section>

      <Section label="Rate Plans">
        {ratePlansQuery.isLoading ? (
          <p className="text-body text-primary-dark/70">Loading rate plans…</p>
        ) : (
          <Table columns={columns} rows={ratePlansQuery.data ?? []} emptyMessage="No rate plans yet — every stay prices at the room type's own base rate." />
        )}
      </Section>
    </Container>
  );
}
