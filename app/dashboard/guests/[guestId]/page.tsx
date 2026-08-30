'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Table, type TableColumn } from '@/components/ui/Table';
import { PageHeader } from '@/components/ui/PageHeader';
import { BackButton } from '@/components/ui/BackButton';
import { MultiSelectTagInput } from '@/components/ui/MultiSelectTagInput';
import { GuestProfileIcon } from '@/components/ui/Icons';
import {
  useGuestProfileQuery,
  useUpdateGuestMutation,
  useAddGuestNoteMutation,
  type GuestProfileDetail,
  type GuestStaySummary,
} from '@/lib/guests';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

const VIP_LEVELS = [0, 1, 2, 3, 4, 5];

function VipLevelSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-small font-semibold text-secondary">VIP Level</label>
      <div className="flex gap-1.5">
        {VIP_LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => onChange(level)}
            className={`size-8 rounded-control border text-small font-semibold transition-colors cursor-pointer ${
              level <= value ? 'bg-primary border-primary text-white' : 'border-secondary-light/40 text-secondary-light hover:bg-secondary-light/20'
            }`}
          >
            {level}
          </button>
        ))}
      </div>
    </div>
  );
}

function ProfileForm({ guest, auth }: { guest: GuestProfileDetail; auth: AuthOpts }) {
  const updateMutation = useUpdateGuestMutation(guest.id, auth);
  const [name, setName] = useState(guest.name);
  const [email, setEmail] = useState(guest.email ?? '');
  const [phone, setPhone] = useState(guest.phone ?? '');
  const [vipLevel, setVipLevel] = useState(guest.vipLevel ?? 0);
  const [tags, setTags] = useState<string[]>(guest.tags ?? []);
  const [loyaltyTier, setLoyaltyTier] = useState(guest.loyaltyTier ?? '');
  const [loyaltyPoints, setLoyaltyPoints] = useState(String(guest.loyaltyPoints ?? 0));
  const [bedType, setBedType] = useState(guest.preferences?.bedType ?? '');
  const [floor, setFloor] = useState(guest.preferences?.floor ?? '');
  const [view, setView] = useState(guest.preferences?.view ?? '');
  const [pillow, setPillow] = useState(guest.preferences?.pillow ?? '');
  const [temp, setTemp] = useState(guest.preferences?.temp ?? '');
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>(guest.preferences?.dietaryRestrictions ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setError(null);
    setSaved(false);
    try {
      await updateMutation.mutateAsync({
        name,
        email: email || undefined,
        phone: phone || undefined,
        vipLevel,
        tags,
        loyaltyTier: loyaltyTier || undefined,
        loyaltyPoints: Number(loyaltyPoints),
        preferences: { bedType: bedType || undefined, floor: floor || undefined, view: view || undefined, pillow: pillow || undefined, temp: temp || undefined, dietaryRestrictions },
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <>
      <Section label="Profile">
        <Card tone="accent" className="flex flex-col gap-3 max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input id="guest-name" label="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input id="guest-email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input id="guest-phone" label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <VipLevelSelector value={vipLevel} onChange={setVipLevel} />
          <MultiSelectTagInput id="guest-tags" label="Tags" options={[]} value={tags} onChange={setTags} allowCustom />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input id="guest-loyalty-tier" label="Loyalty Tier" value={loyaltyTier} onChange={(e) => setLoyaltyTier(e.target.value)} />
            <Input id="guest-loyalty-points" label="Loyalty Points" type="number" min={0} value={loyaltyPoints} onChange={(e) => setLoyaltyPoints(e.target.value)} />
          </div>
        </Card>
      </Section>

      <Section label="Preferences">
        <Card tone="secondary" className="flex flex-col gap-3 max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input id="guest-bed-type" label="Bed Type" value={bedType} onChange={(e) => setBedType(e.target.value)} />
            <Input id="guest-floor" label="Floor" value={floor} onChange={(e) => setFloor(e.target.value)} />
            <Input id="guest-view" label="View" value={view} onChange={(e) => setView(e.target.value)} />
            <Input id="guest-pillow" label="Pillow" value={pillow} onChange={(e) => setPillow(e.target.value)} />
            <Input id="guest-temp" label="Room Temperature" value={temp} onChange={(e) => setTemp(e.target.value)} />
          </div>
          <MultiSelectTagInput id="guest-dietary-restrictions" label="Dietary Restrictions" options={[]} value={dietaryRestrictions} onChange={setDietaryRestrictions} allowCustom />
        </Card>
      </Section>

      {error ? <p className="text-small text-red-600">{error}</p> : null}
      {saved ? <p className="text-small text-green-700">Saved.</p> : null}
      <div>
        <Button type="button" onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? 'Saving…' : 'Save Profile'}
        </Button>
      </div>
    </>
  );
}

function StayHistorySection({ stayHistory }: { stayHistory: GuestStaySummary[] }) {
  const columns: TableColumn<GuestStaySummary>[] = [
    { key: 'confirmationNumber', label: 'Confirmation #', render: (s) => s.confirmationNumber },
    { key: 'roomType', label: 'Room Type', render: (s) => s.roomType.name },
    { key: 'checkInDate', label: 'Check-In', render: (s) => new Date(s.checkInDate).toLocaleDateString(), sortValue: (s) => s.checkInDate },
    { key: 'checkOutDate', label: 'Check-Out', render: (s) => new Date(s.checkOutDate).toLocaleDateString() },
    { key: 'status', label: 'Status', render: (s) => <span className="capitalize">{s.status.replace('_', ' ')}</span> },
    { key: 'confirmedRate', label: 'Rate', align: 'right', render: (s) => s.confirmedRate },
  ];

  return (
    <Section label="Stay History">
      <Card tone="secondary">
        <Table columns={columns} rows={stayHistory} emptyMessage="No stays on file yet." exportFileName="stay-history" />
      </Card>
    </Section>
  );
}

function NotesFeedSection({ guest, auth }: { guest: GuestProfileDetail; auth: AuthOpts }) {
  const addNoteMutation = useAddGuestNoteMutation(guest.id, auth);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    setError(null);
    try {
      await addNoteMutation.mutateAsync(body);
      setBody('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <Section label="Notes">
      <div className="flex flex-col gap-3 max-w-2xl">
        <Card tone="accent" className="flex flex-col gap-2">
          <Textarea id="guest-note-body" label="Add a note" value={body} onChange={(e) => setBody(e.target.value)} />
          {error ? <p className="text-small text-red-600">{error}</p> : null}
          <div>
            <Button type="button" size="sm" onClick={handleAdd} disabled={addNoteMutation.isPending || !body.trim()}>
              {addNoteMutation.isPending ? 'Adding…' : 'Add Note'}
            </Button>
          </div>
        </Card>
        {guest.notesFeed.length === 0 ? (
          <p className="text-small text-secondary-light">No notes yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {guest.notesFeed.map((note) => (
              <Card key={note.id} tone="secondary" className="flex flex-col gap-1">
                <p className="text-body text-secondary">{note.body}</p>
                <p className="text-tiny text-secondary-light">
                  {note.author?.name ?? 'System'} — {new Date(note.createdAt).toLocaleString()}
                </p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}

/** Keyed on the guest's own id so the profile form's lazy `useState` initializers only ever run once real data exists — no effect needed to re-sync when the query resolves. */
function GuestProfileContent({ guest, auth }: { guest: GuestProfileDetail; auth: AuthOpts }) {
  return (
    <>
      <ProfileForm guest={guest} auth={auth} />
      <Card tone="accent" className="max-w-xs">
        <p className="text-tiny text-primary-dark/70">Total Spend</p>
        <p className="text-header font-bold text-primary-dark">{guest.totalSpend}</p>
      </Card>
      <StayHistorySection stayHistory={guest.stayHistory} />
      <NotesFeedSection guest={guest} auth={auth} />
    </>
  );
}

export default function GuestProfilePage() {
  const params = useParams<{ guestId: string }>();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const guestQuery = useGuestProfileQuery(params.guestId, auth);

  return (
    <Container className="max-w-4xl py-10 flex flex-col gap-6">
      <BackButton fallbackHref="/dashboard/guests/profiles" />
      <PageHeader icon={<GuestProfileIcon className="size-8" />} title={guestQuery.data?.name ?? 'Guest Profile'} subtitle="Preferences, loyalty, stay history, and notes" />

      {guestQuery.isLoading ? (
        <p className="text-body text-primary-dark/70">Loading guest…</p>
      ) : guestQuery.isError ? (
        <p className="text-body text-red-600">Could not load this guest. Please try refreshing.</p>
      ) : guestQuery.data ? (
        <GuestProfileContent key={guestQuery.data.id} guest={guestQuery.data} auth={auth} />
      ) : null}
    </Container>
  );
}
