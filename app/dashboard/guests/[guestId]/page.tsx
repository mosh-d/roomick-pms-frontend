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
import { benefitLabel, useAdjustPointsMutation, useEnrollGuestMutation, useGuestLoyaltyQuery } from '@/lib/loyalty';
import { formatMoney } from '@/lib/numberFormat';
import { isSupervisorAtBranch } from '@/lib/roles';
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

/**
 * Points move only through the ledger — earned at check-out, redeemed on a
 * bill, or adjusted here with a reason — so the balance and tier are shown,
 * not typed in.
 */
function LoyaltySection({ guestId, auth, canAdjust }: { guestId: string; auth: AuthOpts; canAdjust: boolean }) {
  const loyaltyQuery = useGuestLoyaltyQuery(guestId, auth);
  const enroll = useEnrollGuestMutation(guestId, auth);
  const adjust = useAdjustPointsMutation(guestId, auth);
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const loyalty = loyaltyQuery.data;

  async function join() {
    setMessage(null);
    try {
      await enroll.mutateAsync();
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.' });
    }
  }

  async function saveAdjustment() {
    setMessage(null);
    try {
      await adjust.mutateAsync({ points: Number(points), reason: reason.trim() });
      setMessage({ kind: 'ok', text: `${Number(points) > 0 ? 'Added' : 'Took off'} ${Math.abs(Number(points)).toLocaleString()} points.` });
      setPoints('');
      setReason('');
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.' });
    }
  }

  if (!loyalty) {
    return (
      <Section label="Loyalty">
        <p className="text-body text-primary-dark/70">{loyaltyQuery.isError ? 'Couldn’t load loyalty.' : 'Loading…'}</p>
      </Section>
    );
  }

  const tierName = loyalty.tier?.name ?? loyalty.tierName;
  const progress = loyalty.nextTier ? Math.min(100, Math.round((loyalty.lifetimePoints / (loyalty.lifetimePoints + loyalty.nextTier.pointsToGo)) * 100)) : 100;

  return (
    <Section label="Loyalty">
      <Card tone="accent" className="flex flex-col gap-3 max-w-2xl">
        {!loyalty.enrolledAt ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-body text-primary-dark">
              {loyalty.programActive ? 'Not a member yet — they join on their own at their next check-out, or now.' : 'Not a member. The loyalty programme is switched off.'}
            </p>
            {loyalty.programActive ? (
              <Button type="button" size="sm" onClick={join} loading={enroll.isPending}>
                Enrol in Loyalty
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              <div>
                <p className="text-tiny text-primary-dark/70">Tier</p>
                <p className="text-body font-semibold text-primary-dark">{tierName ?? 'No tier yet'}</p>
              </div>
              <div>
                <p className="text-tiny text-primary-dark/70">Points</p>
                <p className="text-body font-semibold text-primary-dark">
                  {loyalty.balance.toLocaleString()}
                  {loyalty.redeemableValue && loyalty.balance > 0 ? (
                    <span className="font-normal text-primary-dark/70"> · worth {formatMoney(loyalty.redeemableValue, `${loyalty.currency} `)}</span>
                  ) : null}
                </p>
              </div>
              <div>
                <p className="text-tiny text-primary-dark/70">Lifetime Points</p>
                <p className="text-body font-semibold text-primary-dark">{loyalty.lifetimePoints.toLocaleString()}</p>
              </div>
            </div>
            {loyalty.nextTier ? (
              <div>
                <p className="text-tiny text-primary-dark/70">
                  {loyalty.nextTier.pointsToGo.toLocaleString()} points to {loyalty.nextTier.name}
                </p>
                <div className="mt-1 h-2 rounded-pill bg-secondary/10" role="progressbar" aria-label={`Progress to ${loyalty.nextTier.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                  <div className="h-2 rounded-pill bg-primary" style={{ width: `${progress}%` }} />
                </div>
              </div>
            ) : null}
            {loyalty.tier && loyalty.tier.benefits.length > 0 ? (
              <p className="text-small text-secondary">Benefits: {loyalty.tier.benefits.map(benefitLabel).join(', ')}</p>
            ) : null}
            {!loyalty.programActive ? <p className="text-tiny text-secondary-light">The programme is switched off — nothing is earned or redeemed until it’s back on.</p> : null}
          </>
        )}

        {loyalty.transactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-small text-secondary">
              <thead>
                <tr className="text-left font-bold">
                  <th className="py-1 pr-4">Date</th>
                  <th className="py-1 pr-4">What</th>
                  <th className="py-1 text-right">Points</th>
                </tr>
              </thead>
              <tbody>
                {loyalty.transactions.map((t) => (
                  <tr key={t.id} className="border-t border-secondary/10">
                    <td className="py-1 pr-4 whitespace-nowrap">{new Date(t.createdAt).toLocaleDateString()}</td>
                    <td className="py-1 pr-4">{t.description}</td>
                    <td className={`py-1 text-right whitespace-nowrap ${t.points < 0 ? 'text-red-700' : 'text-green-700'}`}>
                      {t.points > 0 ? '+' : ''}
                      {t.points.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {canAdjust ? (
          <div className="grid grid-cols-1 sm:grid-cols-[8rem_1fr_auto] gap-3 items-end border-t border-secondary/20 pt-3">
            <Input id="loyalty-adjust-points" label="Adjust Points" type="number" value={points} onChange={(e) => setPoints(e.target.value)} placeholder="250 or -100" />
            <Input id="loyalty-adjust-reason" label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Goodwill — noisy room" />
            <Button
              type="button"
              variant="outline"
              className="mb-2"
              onClick={saveAdjustment}
              loading={adjust.isPending}
              disabled={!points || Number(points) === 0 || !Number.isInteger(Number(points)) || reason.trim().length < 3}
            >
              Save
            </Button>
          </div>
        ) : null}
        {message ? <p className={`text-small ${message.kind === 'error' ? 'text-red-600' : 'text-green-700'}`}>{message.text}</p> : null}
      </Card>
    </Section>
  );
}

/** Keyed on the guest's own id so the profile form's lazy `useState` initializers only ever run once real data exists — no effect needed to re-sync when the query resolves. */
function GuestProfileContent({ guest, auth, canAdjustPoints }: { guest: GuestProfileDetail; auth: AuthOpts; canAdjustPoints: boolean }) {
  return (
    <>
      <ProfileForm guest={guest} auth={auth} />
      <LoyaltySection guestId={guest.id} auth={auth} canAdjust={canAdjustPoints} />
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
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const canAdjustPoints = activeBranchId ? isSupervisorAtBranch(user, activeBranchId) : false;

  return (
    <Container className="max-w-4xl py-10 flex flex-col gap-6">
      <BackButton fallbackHref="/dashboard/guests/profiles" />
      <PageHeader icon={<GuestProfileIcon className="size-8" />} title={guestQuery.data?.name ?? 'Guest Profile'} subtitle="Preferences, loyalty, stay history, and notes" />

      {guestQuery.isLoading ? (
        <p className="text-body text-primary-dark/70">Loading guest…</p>
      ) : guestQuery.isError ? (
        <p className="text-body text-red-600">Could not load this guest. Please try refreshing.</p>
      ) : guestQuery.data ? (
        <GuestProfileContent key={guestQuery.data.id} guest={guestQuery.data} auth={auth} canAdjustPoints={canAdjustPoints} />
      ) : null}
    </Container>
  );
}
