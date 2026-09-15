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
import { MultiSelectTagInput } from '@/components/ui/MultiSelectTagInput';
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
  useSetCancellationPolicyMutation,
  DEFAULT_CANCELLATION_POLICY,
  type PenaltyType,
  useBookingEngineQuery,
  usePublishBookingEngineMutation,
  useUnpublishBookingEngineMutation,
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
  const [flatFeeAmount, setFlatFeeAmount] = useState(branch.noShowPolicy?.flatFeeAmount ? String(branch.noShowPolicy.flatFeeAmount) : '');
  const [autoMark, setAutoMark] = useState(branch.noShowPolicy?.autoMark ?? false);
  const [notifyMinutesBefore, setNotifyMinutesBefore] = useState(String(branch.noShowPolicy?.notifyMinutesBefore ?? 120));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // "Flat Fee" used to be selectable with nowhere to enter the fee — the policy saved, and every no-show was charged nothing.
  const feeValid = defaultPenalty !== 'flat_fee' || Number(flatFeeAmount) > 0;

  function edited() {
    setSaved(false);
    setError(null);
  }

  return (
    <Section label="No-Show Policy">
      <Card tone="secondary" className="flex flex-col gap-3 max-w-lg">
        <Input
          id="noshow-cutoff"
          label="Cutoff Time"
          type="time"
          hint="Night audit auto-marks a no-show once this time passes with no check-in."
          value={cutoffTime}
          onChange={(e) => { setCutoffTime(e.target.value); edited(); }}
        />
        <Select id="noshow-default-penalty" label="Default Penalty" options={PENALTY_OPTIONS} value={defaultPenalty} onChange={(v) => { setDefaultPenalty(v); edited(); }} />
        {defaultPenalty === 'flat_fee' ? (
          <Input
            id="noshow-flat-fee"
            label="Flat Fee Amount"
            type="number"
            min={0}
            step="0.01"
            hint="What a no-show is charged under this policy."
            value={flatFeeAmount}
            onChange={(e) => { setFlatFeeAmount(e.target.value); edited(); }}
          />
        ) : null}
        <YesNoToggle label="Auto-mark no-shows during night audit" name="autoMark" value={autoMark ? 'yes' : 'no'} onChange={(v) => { setAutoMark(v === 'yes'); edited(); }} />
        <Input
          id="noshow-notify-minutes"
          label="Notify Minutes Before Cutoff"
          type="number"
          min={0}
          value={notifyMinutesBefore}
          onChange={(e) => { setNotifyMinutesBefore(e.target.value); edited(); }}
        />
        {error ? <p className="text-small text-red-600">{error}</p> : null}
        {saved ? <p className="text-small text-green-700">Saved.</p> : null}
        <div>
          <Button
            type="button"
            onClick={() =>
              updateMutation.mutate(
                {
                  cutoffTime,
                  defaultPenalty,
                  flatFeeAmount: defaultPenalty === 'flat_fee' ? Number(flatFeeAmount) : undefined,
                  autoMark,
                  notifyMinutesBefore: Number(notifyMinutesBefore),
                },
                {
                  onSuccess: () => setSaved(true),
                  onError: (e) => setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.'),
                },
              )
            }
            disabled={updateMutation.isPending || !feeValid}
          >
            {updateMutation.isPending ? 'Saving…' : 'Save No-Show Policy'}
          </Button>
        </div>
      </Card>
    </Section>
  );
}

const CANCELLATION_PENALTY_OPTIONS: SelectOption[] = [
  { value: 'first_night', label: 'First Night' },
  { value: 'full_stay', label: 'Full Stay' },
  { value: 'flat_fee', label: 'Flat Fee' },
  { value: 'none', label: 'Nothing — always free' },
];

/**
 * Cancellation policy (pms-frontend-structure-2.html's "Policy configuration
 * section"). The backend applies it to every cancellation — front desk,
 * manager override and guests cancelling online — and generates the sentence
 * guests read from it, so there's no separate policy text to keep in step. A
 * branch that has never saved one runs on the standard default, and this says
 * so.
 */
function CancellationPolicySection({ branch, auth }: { branch: BranchDetail; auth: AuthOpts }) {
  const updateMutation = useSetCancellationPolicyMutation(branch.id, auth);
  const current = branch.cancellationPolicy ?? DEFAULT_CANCELLATION_POLICY;
  const [hours, setHours] = useState(String(current.freeCancellationHours));
  const [penalty, setPenalty] = useState<PenaltyType>(current.lateCancellationPenalty);
  const [flatFee, setFlatFee] = useState(current.flatFeeAmount ? String(current.flatFeeAmount) : '');
  const [online, setOnline] = useState(current.allowOnlineCancellation);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hoursValid = /^\d+$/.test(hours) && Number(hours) <= 720;
  const feeValid = penalty !== 'flat_fee' || Number(flatFee) > 0;

  function edited() {
    setSaved(false);
    setError(null);
  }

  function save() {
    updateMutation.mutate(
      {
        freeCancellationHours: Number(hours),
        lateCancellationPenalty: penalty,
        flatFeeAmount: penalty === 'flat_fee' ? Number(flatFee) : undefined,
        allowOnlineCancellation: online,
      },
      {
        onSuccess: () => setSaved(true),
        onError: (e) => setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.'),
      },
    );
  }

  return (
    <Section label="Cancellation Policy">
      <Card tone="secondary" className="flex flex-col gap-3 max-w-lg">
        {branch.cancellationPolicy ? null : (
          <p className="text-small text-secondary">
            Running on the standard default until you save your own: free cancellation until 24 hours before check-in, then the first night is charged.
          </p>
        )}
        <Input
          id="cancellation-free-hours"
          label="Free Cancellation Until (hours before check-in)"
          type="number"
          min={0}
          max={720}
          hint="Counted back from the check-in time on the arrival day. 0 means free right up to check-in."
          value={hours}
          onChange={(e) => { setHours(e.target.value); edited(); }}
        />
        <Select
          id="cancellation-penalty"
          label="Charge After That"
          options={CANCELLATION_PENALTY_OPTIONS}
          value={penalty}
          onChange={(v) => { setPenalty(v as PenaltyType); edited(); }}
        />
        {penalty === 'flat_fee' ? (
          <Input
            id="cancellation-flat-fee"
            label="Cancellation Fee"
            type="number"
            min={0}
            step="0.01"
            value={flatFee}
            onChange={(e) => { setFlatFee(e.target.value); edited(); }}
          />
        ) : null}
        <YesNoToggle label="Guests can cancel online" name="allowOnlineCancellation" value={online ? 'yes' : 'no'} onChange={(v) => { setOnline(v === 'yes'); edited(); }} />
        <p className="text-tiny text-secondary-light">
          Changes apply to new bookings — each booking keeps the terms it was made under. Online cancellation closes at check-in time on the arrival day; after that the no-show policy applies. Staff can always cancel from Cancel Reservation, and managers can waive the charge there.
        </p>
        {error ? <p className="text-small text-red-600">{error}</p> : null}
        {saved ? <p className="text-small text-green-700">Saved.</p> : null}
        <div>
          <Button type="button" onClick={save} disabled={updateMutation.isPending || !hoursValid || !feeValid}>
            {updateMutation.isPending ? 'Saving…' : 'Save Cancellation Policy'}
          </Button>
        </div>
      </Card>
    </Section>
  );
}

/** Slugify exactly the way the backend's own `PublishBookingEngineDto` validates: lowercase alphanumeric words separated by single hyphens. */
function toSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

/**
 * Direct Booking Engine controls (Month 7). The endpoints shipped with the
 * backend but had no UI, so publishing a property meant calling the API by
 * hand — this is that gap closed.
 *
 * Publishing is a genuinely outward-facing action (it puts a page on the
 * public internet), so the slug is previewed as the full URL before the
 * button is pressed, and unpublishing is offered right next to it.
 */
function BookingEngineSection({ branch, auth }: { branch: BranchDetail; auth: AuthOpts }) {
  const statusQuery = useBookingEngineQuery(branch.id, auth);
  const publishMutation = usePublishBookingEngineMutation(branch.id, auth);
  const unpublishMutation = useUnpublishBookingEngineMutation(branch.id, auth);

  const status = statusQuery.data;
  // Keyed on the loaded status so the field initialises once the real slug
  // arrives, without a set-state-in-effect.
  return statusQuery.isLoading ? (
    <Section label="Direct Booking Engine">
      <p className="text-body text-primary-dark/70">Loading…</p>
    </Section>
  ) : (
    <BookingEngineForm
      key={status?.slug ?? 'unpublished'}
      branchName={branch.name}
      status={status ?? { slug: null, bookingEngineEnabled: false }}
      onPublish={(slug) => publishMutation.mutateAsync({ slug })}
      onUnpublish={() => unpublishMutation.mutateAsync()}
      publishing={publishMutation.isPending}
      unpublishing={unpublishMutation.isPending}
    />
  );
}

function BookingEngineForm({
  branchName,
  status,
  onPublish,
  onUnpublish,
  publishing,
  unpublishing,
}: {
  branchName: string;
  status: { slug: string | null; bookingEngineEnabled: boolean };
  onPublish: (slug: string) => Promise<unknown>;
  onUnpublish: () => Promise<unknown>;
  publishing: boolean;
  unpublishing: boolean;
}) {
  const [slug, setSlug] = useState(() => status.slug ?? toSlug(branchName));
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const normalised = toSlug(slug);
  const bookingUrl = typeof window === 'undefined' ? `/book/${normalised}` : `${window.location.origin}/book/${normalised}`;
  const liveUrl = status.slug ? (typeof window === 'undefined' ? `/book/${status.slug}` : `${window.location.origin}/book/${status.slug}`) : null;

  async function publish() {
    if (!normalised) return;
    setError(null);
    try {
      await onPublish(normalised);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  async function unpublish() {
    setError(null);
    try {
      await onUnpublish();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <Section label="Direct Booking Engine">
      <Card tone="secondary" className="flex flex-col gap-3 max-w-2xl">
        <p className="text-small text-secondary">
          Take bookings directly from your own website with no channel commission. Guests book at a public address without needing an account, and their
          reservations arrive in Roomick exactly like a front-desk booking.
        </p>

        {status.bookingEngineEnabled && liveUrl ? (
          <div className="flex flex-wrap items-center gap-2 rounded-control bg-green-700/10 px-3 py-2">
            <span className="text-small font-semibold text-green-800">Live</span>
            <a href={liveUrl} target="_blank" rel="noreferrer" className="text-small text-secondary underline break-all">
              {liveUrl}
            </a>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(liveUrl).then(() => setCopied(true));
              }}
            >
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          </div>
        ) : (
          <p className="text-small text-secondary-light">
            Not published — this property currently accepts no online bookings{status.slug ? `, but "${status.slug}" stays reserved for it.` : '.'}
          </p>
        )}

        <Input
          id="booking-engine-slug"
          label="Public booking address"
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            setError(null);
          }}
          hint="Lowercase letters, numbers and hyphens. Guests will see this in the URL."
        />
        <p className="text-tiny text-secondary-light break-all">
          Will publish at <span className="font-semibold text-secondary">{bookingUrl}</span>
        </p>

        {error ? <p className="text-small text-red-600">{error}</p> : null}

        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={publish} loading={publishing} disabled={!normalised}>
            {status.bookingEngineEnabled ? (normalised === status.slug ? 'Republish' : 'Change address') : 'Publish'}
          </Button>
          {status.bookingEngineEnabled ? (
            <Button type="button" variant="outline" onClick={unpublish} loading={unpublishing}>
              Unpublish
            </Button>
          ) : null}
        </div>

        <p className="text-tiny text-secondary-light">
          Guests pay at the property on arrival — card payment at the time of booking isn&apos;t built yet. Changing the address takes the old link down
          immediately.
        </p>
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

/** Starting suggestions only — `allowCustom` means a property can type anything else it offers. */
const AMENITY_OPTIONS = [
  { value: 'WiFi', label: 'WiFi' },
  { value: 'Air conditioning', label: 'Air conditioning' },
  { value: 'Television', label: 'Television' },
  { value: 'Private bathroom', label: 'Private bathroom' },
  { value: 'Balcony', label: 'Balcony' },
  { value: 'Sea view', label: 'Sea view' },
  { value: 'Kitchenette', label: 'Kitchenette' },
  { value: 'Work desk', label: 'Work desk' },
  { value: 'Safe', label: 'Safe' },
  { value: 'Mini bar', label: 'Mini bar' },
  { value: 'Room service', label: 'Room service' },
  { value: 'Breakfast included', label: 'Breakfast included' },
];

/**
 * A repeatable list of image URLs, with a live thumbnail per row.
 *
 * URLs rather than uploads on purpose: `RoomType.photoUrls` is a `String[]`
 * and this app has no image-upload/hosting path — the only file storage that
 * exists is for encrypted compliance documents, which is a deliberately
 * different thing (private, encrypted, access-controlled) from a public
 * marketing photo. Pasting a URL from wherever the property already hosts its
 * images is the honest capability today; an uploader would need real image
 * hosting behind it.
 *
 * The thumbnail matters because a typo'd URL is otherwise invisible until a
 * guest loads the booking page and sees a broken image.
 */
function PhotoUrlListInput({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const rows = value.length > 0 ? value : [''];

  function update(index: number, next: string) {
    const copy = [...rows];
    copy[index] = next;
    onChange(copy);
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-small font-semibold text-secondary">Photos (optional)</span>
      {rows.map((url, index) => (
        // Index key is correct here: these rows have no stable identity of
        // their own and are edited in place, so keying by value would
        // remount the focused input on every keystroke.
        <div key={index} className="flex items-center gap-2">
          {url.trim() ? (
            // Deliberately a plain <img>, not next/image: these are arbitrary
            // third-party URLs, and next/image would need every possible host
            // allow-listed in next.config.ts up front.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="size-10 shrink-0 rounded-control object-cover border border-secondary/20" />
          ) : (
            <span className="size-10 shrink-0 rounded-control border border-dashed border-secondary/30" aria-hidden />
          )}
          <div className="flex-1">
            <Input id={`room-type-photo-${index}`} label="" value={url} onChange={(e) => update(index, e.target.value)} placeholder="https://…" />
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => onChange(rows.filter((_, i) => i !== index))} disabled={rows.length === 1 && !rows[0]}>
            Remove
          </Button>
        </div>
      ))}
      <div>
        <Button type="button" size="sm" variant="outline" onClick={() => onChange([...rows, ''])} disabled={rows.some((u) => !u.trim())}>
          Add photo
        </Button>
      </div>
      <p className="text-tiny text-secondary-light">Paste image links from wherever you already host them. The first photo is the one guests see first.</p>
    </div>
  );
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
  const [sizeM2, setSizeM2] = useState(existing?.sizeM2 ?? '');
  const [amenities, setAmenities] = useState<string[]>(existing?.amenities ?? []);
  const [photoUrls, setPhotoUrls] = useState<string[]>(existing?.photoUrls ?? []);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    const body = {
      name,
      baseRate: Number(baseRate),
      capacity: { adults: Number(adults), children: Number(children) },
      bedType: bedType || undefined,
      sizeM2: sizeM2 ? Number(sizeM2) : undefined,
      amenities,
      // Trim blanks so an empty row left behind in the editor never reaches
      // the public booking page as a broken image.
      photoUrls: photoUrls.map((u) => u.trim()).filter(Boolean),
    };
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
      <div className="grid grid-cols-2 gap-3">
        <Input id="room-type-bed-type" label="Bed Type (optional)" value={bedType} onChange={(e) => setBedType(e.target.value)} />
        <Input id="room-type-size" label="Size m² (optional)" type="number" min={0} step="0.1" value={sizeM2} onChange={(e) => setSizeM2(e.target.value)} />
      </div>
      <MultiSelectTagInput
        id="room-type-amenities"
        label="Amenities (optional)"
        options={AMENITY_OPTIONS}
        value={amenities}
        onChange={setAmenities}
        allowCustom
        hint="Shown to guests on your public booking page."
      />
      <PhotoUrlListInput value={photoUrls} onChange={setPhotoUrls} />
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
          <BookingEngineSection branch={branchQuery.data} auth={auth} />
          <NoShowPolicySection branch={branchQuery.data} auth={auth} />
          <CancellationPolicySection branch={branchQuery.data} auth={auth} />
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
