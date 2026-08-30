'use client';

import { useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { YesNoToggle } from '@/components/ui/YesNoToggle';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Table, type TableColumn } from '@/components/ui/Table';
import { PageHeader } from '@/components/ui/PageHeader';
import { PropertyConfigIcon, HotelCheckInIcon, OverbookingIcon } from '@/components/ui/Icons';
import { HubCard } from '../_components/HubCard';
import {
  useBrandsQuery,
  useUpdateBrandMutation,
  useBranchDetailQuery,
  useUpdateBranchMutation,
  useSetNoShowPolicyMutation,
  type BranchDetail,
} from '@/lib/propertyConfig';
import { useRoomTypesQuery, useCreateRoomTypeMutation, useUpdateRoomTypeMutation, type RoomTypeSummary } from '@/lib/rooms';
import { COUNTRIES } from '@/lib/countries';
import { timezoneOptionsFor } from '@/lib/timezones';
import { formatMoney } from '@/lib/numberFormat';
import { currencySymbolFor } from '@/lib/currencies';
import { isOwner } from '@/lib/roles';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

/** `Branch.checkInTime`/`checkOutTime` are Postgres `TIME` columns, but Prisma/JSON always renders them as a full `DateTime` on the 1970-01-01 epoch (e.g. `"1970-01-01T14:00:00.000Z"`) — this pulls out just the `type="time"` input's own `HH:mm` value. */
function timeOfDay(iso: string): string {
  return iso.slice(11, 16);
}

const CATEGORY_OPTIONS: SelectOption[] = [
  { value: 'hotel', label: 'Hotel' },
  { value: 'resort', label: 'Resort' },
  { value: 'motel', label: 'Motel' },
  { value: 'boutique', label: 'Boutique' },
  { value: 'hostel', label: 'Hostel' },
];

const PENALTY_OPTIONS: SelectOption[] = [
  { value: 'first_night', label: 'First Night' },
  { value: 'full_stay', label: 'Full Stay' },
  { value: 'flat_fee', label: 'Flat Fee' },
  { value: 'none', label: 'None' },
];

function BrandSection({ auth }: { auth: AuthOpts }) {
  const brandsQuery = useBrandsQuery(auth);
  const brand = brandsQuery.data?.[0];

  if (brandsQuery.isLoading) return null;
  if (!brand) return null;

  return (
    <Section label="Brand">
      {/* Keyed on the brand's own id so this only ever mounts once real
          data exists — a lazy `useState` initializer below picks it up
          directly, no effect needed to sync server data into local state. */}
      <BrandForm key={brand.id} brand={brand} auth={auth} />
    </Section>
  );
}

function BrandForm({ brand, auth }: { brand: { id: string; name: string; logoUrl: string | null }; auth: AuthOpts }) {
  const updateMutation = useUpdateBrandMutation(auth);
  const [name, setName] = useState(brand.name);
  const [logoUrl, setLogoUrl] = useState(brand.logoUrl ?? '');
  const [saved, setSaved] = useState(false);

  return (
    <Card tone="accent" className="flex flex-col gap-3 max-w-lg">
      <Input id="brand-name" label="Brand Name" value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} />
      <Input id="brand-logo-url" label="Logo URL" value={logoUrl} onChange={(e) => { setLogoUrl(e.target.value); setSaved(false); }} />
      {saved ? <p className="text-small text-green-700">Saved.</p> : null}
      <div>
        <Button
          type="button"
          onClick={() => updateMutation.mutate({ brandId: brand.id, name, logoUrl }, { onSuccess: () => setSaved(true) })}
          disabled={updateMutation.isPending || !name}
        >
          {updateMutation.isPending ? 'Saving…' : 'Save Brand'}
        </Button>
      </div>
    </Card>
  );
}

function BranchDetailsSection({ branch, auth }: { branch: BranchDetail; auth: AuthOpts }) {
  const updateMutation = useUpdateBranchMutation(branch.id, auth);
  const [form, setForm] = useState({
    name: branch.name,
    street: branch.address.street,
    city: branch.address.city,
    state: branch.address.state ?? '',
    country: branch.address.country,
    zip: branch.address.zip ?? '',
    timezone: branch.timezone,
    currency: branch.currency,
    checkInTime: timeOfDay(branch.checkInTime),
    checkOutTime: timeOfDay(branch.checkOutTime),
    category: branch.category ?? '',
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setError(null);
    try {
      await updateMutation.mutateAsync({
        name: form.name,
        address: { street: form.street, city: form.city, state: form.state || undefined, country: form.country, zip: form.zip || undefined },
        timezone: form.timezone,
        currency: form.currency,
        checkInTime: form.checkInTime,
        checkOutTime: form.checkOutTime,
        category: form.category || undefined,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <Section label="Branch Details">
      <Card tone="secondary" className="flex flex-col gap-3 max-w-2xl">
        <Input id="branch-name" label="Branch Name" value={form.name} onChange={(e) => set('name', e.target.value)} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input id="branch-street" label="Street" value={form.street} onChange={(e) => set('street', e.target.value)} />
          <Input id="branch-city" label="City" value={form.city} onChange={(e) => set('city', e.target.value)} />
          <Input id="branch-state" label="State (optional)" value={form.state} onChange={(e) => set('state', e.target.value)} />
          <Select id="branch-country" label="Country" options={COUNTRIES} value={form.country} onChange={(v) => set('country', v)} />
          <Input id="branch-zip" label="ZIP (optional)" value={form.zip} onChange={(e) => set('zip', e.target.value)} />
          <Select id="branch-timezone" label="Timezone" options={timezoneOptionsFor(form.country)} value={form.timezone} onChange={(v) => set('timezone', v)} />
          <Input id="branch-currency" label="Currency (ISO 4217)" value={form.currency} onChange={(e) => set('currency', e.target.value.toUpperCase())} />
          <Select id="branch-category" label="Category" options={CATEGORY_OPTIONS} value={form.category || null} onChange={(v) => set('category', v)} placeholder="Select a category" />
          <Input id="branch-checkin" label="Check-In Time" type="time" value={form.checkInTime} onChange={(e) => set('checkInTime', e.target.value)} />
          <Input id="branch-checkout" label="Check-Out Time" type="time" value={form.checkOutTime} onChange={(e) => set('checkOutTime', e.target.value)} />
        </div>
        {error ? <p className="text-small text-red-600">{error}</p> : null}
        {saved ? <p className="text-small text-green-700">Saved.</p> : null}
        <div>
          <Button type="button" onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving…' : 'Save Branch Details'}
          </Button>
        </div>
      </Card>
    </Section>
  );
}

function NoShowPolicySection({ branch, auth }: { branch: BranchDetail; auth: AuthOpts }) {
  const updateMutation = useSetNoShowPolicyMutation(branch.id, auth);
  const [cutoffTime, setCutoffTime] = useState(branch.noShowPolicy?.cutoffTime ?? '18:00');
  const [defaultPenalty, setDefaultPenalty] = useState(branch.noShowPolicy?.defaultPenalty ?? 'none');
  const [autoMark, setAutoMark] = useState(branch.noShowPolicy?.autoMark ?? false);
  const [notifyMinutesBefore, setNotifyMinutesBefore] = useState(String(branch.noShowPolicy?.notifyMinutesBefore ?? 120));
  const [saved, setSaved] = useState(false);

  return (
    <Section label="No-Show Policy">
      <Card tone="secondary" className="flex flex-col gap-3 max-w-lg">
        <Input
          id="noshow-cutoff"
          label="Cutoff Time"
          type="time"
          hint="Night audit auto-marks a no-show once this time passes with no check-in."
          value={cutoffTime}
          onChange={(e) => { setCutoffTime(e.target.value); setSaved(false); }}
        />
        <Select id="noshow-default-penalty" label="Default Penalty" options={PENALTY_OPTIONS} value={defaultPenalty} onChange={(v) => { setDefaultPenalty(v); setSaved(false); }} />
        <YesNoToggle label="Auto-mark no-shows during night audit" name="autoMark" value={autoMark ? 'yes' : 'no'} onChange={(v) => { setAutoMark(v === 'yes'); setSaved(false); }} />
        <Input
          id="noshow-notify-minutes"
          label="Notify Minutes Before Cutoff"
          type="number"
          min={0}
          value={notifyMinutesBefore}
          onChange={(e) => { setNotifyMinutesBefore(e.target.value); setSaved(false); }}
        />
        {saved ? <p className="text-small text-green-700">Saved.</p> : null}
        <div>
          <Button
            type="button"
            onClick={() =>
              updateMutation.mutate(
                { cutoffTime, defaultPenalty, autoMark, notifyMinutesBefore: Number(notifyMinutesBefore) },
                { onSuccess: () => setSaved(true) },
              )
            }
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? 'Saving…' : 'Save Policy'}
          </Button>
        </div>
      </Card>
    </Section>
  );
}

function RoomTypeModal({
  open,
  onClose,
  branchId,
  auth,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  branchId: string;
  auth: AuthOpts;
  existing: RoomTypeSummary | null;
}) {
  if (!open) return null;
  // Keyed on which room type (or "new") this open targets — the modal
  // fully unmounts on close either way, but the key also protects against
  // switching targets without a close in between, same pattern as
  // ExtendStayDialog's own fix for this.
  return <RoomTypeModalInner key={existing?.id ?? 'new'} onClose={onClose} branchId={branchId} auth={auth} existing={existing} />;
}

function RoomTypeModalInner({
  onClose,
  branchId,
  auth,
  existing,
}: {
  onClose: () => void;
  branchId: string;
  auth: AuthOpts;
  existing: RoomTypeSummary | null;
}) {
  const createMutation = useCreateRoomTypeMutation(branchId, auth);
  const updateMutation = useUpdateRoomTypeMutation(branchId, auth);
  const [name, setName] = useState(existing?.name ?? '');
  const [baseRate, setBaseRate] = useState(existing?.baseRate ?? '');
  const [adults, setAdults] = useState(String(existing?.capacity.adults ?? 2));
  const [children, setChildren] = useState(String(existing?.capacity.children ?? 0));
  const [bedType, setBedType] = useState(existing?.bedType ?? '');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    const body = { name, baseRate: Number(baseRate), capacity: { adults: Number(adults), children: Number(children) }, bedType: bedType || undefined };
    try {
      if (existing) await updateMutation.mutateAsync({ roomTypeId: existing.id, ...body });
      else await createMutation.mutateAsync(body);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  const pending = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal open onClose={onClose} title={existing ? `Edit ${existing.name}` : 'Add Room Type'}>
      <Input id="room-type-name" label="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <Input id="room-type-base-rate" label="Base Nightly Rate" type="number" min={0} step="0.01" value={baseRate} onChange={(e) => setBaseRate(e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <Input id="room-type-adults" label="Max Adults" type="number" min={1} max={20} value={adults} onChange={(e) => setAdults(e.target.value)} />
        <Input id="room-type-children" label="Max Children" type="number" min={0} max={20} value={children} onChange={(e) => setChildren(e.target.value)} />
      </div>
      <Input id="room-type-bed-type" label="Bed Type (optional)" value={bedType} onChange={(e) => setBedType(e.target.value)} />
      {error ? <p className="text-small text-red-600">{error}</p> : null}
      {existing ? <p className="text-tiny text-secondary-light">Changing the rate only affects future bookings — existing reservations keep their own confirmed rate.</p> : null}
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={pending || !name || !baseRate}>
          {pending ? 'Saving…' : existing ? 'Save Changes' : 'Add Room Type'}
        </Button>
      </div>
    </Modal>
  );
}

function RoomTypesSection({ branchId, currency, auth }: { branchId: string; currency: string | undefined; auth: AuthOpts }) {
  const roomTypesQuery = useRoomTypesQuery(branchId, auth);
  const [modalTarget, setModalTarget] = useState<{ open: boolean; existing: RoomTypeSummary | null }>({ open: false, existing: null });
  const currencySymbol = currencySymbolFor(currency);

  const columns: TableColumn<RoomTypeSummary>[] = [
    { key: 'name', label: 'Name', render: (rt) => rt.name, sortValue: (rt) => rt.name },
    { key: 'baseRate', label: 'Base Rate', align: 'right', render: (rt) => formatMoney(rt.baseRate, currencySymbol), sortValue: (rt) => Number(rt.baseRate) },
    { key: 'capacity', label: 'Capacity', render: (rt) => `${rt.capacity.adults} adult(s), ${rt.capacity.children} child(ren)` },
    { key: 'bedType', label: 'Bed Type', render: (rt) => rt.bedType ?? '—' },
    {
      key: 'action',
      label: 'Action',
      align: 'right',
      render: (rt) => (
        <Button size="sm" variant="outline" onClick={() => setModalTarget({ open: true, existing: rt })}>
          Edit
        </Button>
      ),
    },
  ];

  return (
    <Section label="Room Types">
      <div className="flex flex-col gap-3">
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setModalTarget({ open: true, existing: null })}>
            Add Room Type
          </Button>
        </div>
        {roomTypesQuery.isLoading ? (
          <p className="text-body text-primary-dark/70">Loading room types…</p>
        ) : (
          <Card tone="secondary">
            <Table columns={columns} rows={roomTypesQuery.data ?? []} emptyMessage="No room types configured yet." exportFileName="room-types" />
          </Card>
        )}
      </div>
      <RoomTypeModal open={modalTarget.open} onClose={() => setModalTarget({ open: false, existing: null })} branchId={branchId} auth={auth} existing={modalTarget.existing} />
    </Section>
  );
}

/**
 * Property Config (pms-frontend-structure-2.html's own `page-propertyconfig`)
 * — third of the 11 Management/Admin gaps. Consolidates settings that
 * already existed scattered across onboarding (brand, branch, room types,
 * no-show policy) into one real page, rather than rebuilding what already
 * has a good home (Registration Card Template, Overbooking Config both
 * link out to their own existing pages instead of being duplicated here).
 *
 * Two real backend gaps this depended on and closed: there was no
 * single-branch GET at all (only a trimmed, Owner-only list), and no room
 * type UPDATE endpoint (create-only since onboarding) — see the backend's
 * own PHASE_NOTES.md.
 */
export default function PropertyConfigPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const branchQuery = useBranchDetailQuery(activeBranchId, auth);

  if (!activeBranchId) return null;

  return (
    <Container className="max-w-5xl py-10 flex flex-col gap-8">
      <PageHeader
        icon={<PropertyConfigIcon className="size-8" />}
        title="Property Config"
        subtitle="Room types, policies, tax rules, payment methods, channel manager, facilities."
        roles="Admin · Manager"
      />

      {isOwner(user) ? <BrandSection auth={auth} /> : null}

      {branchQuery.isLoading ? (
        <p className="text-body text-primary-dark/70">Loading branch settings…</p>
      ) : branchQuery.data ? (
        <>
          <BranchDetailsSection branch={branchQuery.data} auth={auth} />
          <NoShowPolicySection branch={branchQuery.data} auth={auth} />
        </>
      ) : null}

      <RoomTypesSection branchId={activeBranchId} currency={branchQuery.data?.currency} auth={auth} />

      <Section label="More Settings">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <HubCard icon={<HotelCheckInIcon className="size-5" />} title="Registration Card Template" description="House rules, required fields, language" href="/dashboard/registration-cards" />
          <HubCard icon={<OverbookingIcon className="size-5" />} title="Overbooking Management" description="Per-room-type overbooking limits and alerts" href="/dashboard/overbooking" />
        </div>
        <p className="text-tiny text-secondary-light mt-2">
          Buildings and floors can only be structured during onboarding today — editing an existing property&apos;s physical layout isn&apos;t built yet.
        </p>
      </Section>
    </Container>
  );
}
