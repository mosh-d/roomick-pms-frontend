'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select, type SelectOption } from '@/components/ui/Select';
import { YesNoToggle } from '@/components/ui/YesNoToggle';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { HotelCheckInIcon } from '@/components/ui/Icons';
import { useReservationsQuery } from '@/lib/reservations';
import { useRegCardTemplateQuery, useSetRegCardTemplateMutation, useGenerateRegistrationCardMutation, type RegCardTemplate } from '@/lib/registration-cards';
import { LANGUAGES } from '@/lib/languages';
import { apiFetch, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

/**
 * Guest Registration Card hub — the sidebar's own landing spot for a
 * feature that's otherwise reached by redirect, not by browsing (see the
 * `[cardId]` page's own comment: check-in generates a card automatically
 * and sends the agent straight there). This page covers the two things
 * that AREN'T check-in-triggered: configuring the branch's own template
 * (house rules, logo, language), and looking up an already-checked-in
 * guest's card — to re-view a signed one, or generate one for a stay
 * that was checked in before this module existed.
 */
export default function RegistrationCardsHubPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  const templateQuery = useRegCardTemplateQuery(activeBranchId, auth);
  const checkedInQuery = useReservationsQuery(activeBranchId, { status: 'checked_in' }, auth);
  const generateMutation = useGenerateRegistrationCardMutation(auth);

  const reservationOptions: SelectOption[] = useMemo(
    () => (checkedInQuery.data ?? []).map((r) => ({ value: r.id, label: `${r.guest.name} — Room ${r.room?.number ?? '—'} (${r.confirmationNumber})` })),
    [checkedInQuery.data],
  );

  if (!activeBranchId) return null;

  async function viewCard() {
    if (!selectedReservationId) return;
    setLookupError(null);
    setLookupLoading(true);
    try {
      const existing = await apiFetch<{ id: string } | null>(`/reservations/${selectedReservationId}/registration-card`, auth);
      if (existing) {
        router.push(`/dashboard/registration-cards/${existing.id}`);
        return;
      }
      const generated = await generateMutation.mutateAsync(selectedReservationId);
      router.push(`/dashboard/registration-cards/${generated.id}`);
    } catch (error) {
      setLookupError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    } finally {
      setLookupLoading(false);
    }
  }

  return (
    <Container className="max-w-3xl py-10 flex flex-col gap-8">
      <PageHeader icon={<HotelCheckInIcon className="size-8" />} title="Guest Registration Card" subtitle="Template settings and card lookup" />

      <Section label="Card Template">
        {templateQuery.isLoading ? (
          <p className="text-body text-primary-dark/70">Loading…</p>
        ) : (
          <TemplateForm initial={templateQuery.data ?? {}} branchId={activeBranchId} auth={auth} />
        )}
      </Section>

      <Section label="Look Up a Card">
        {checkedInQuery.isLoading ? (
          <p className="text-body text-primary-dark/70">Loading…</p>
        ) : reservationOptions.length === 0 ? (
          <p className="text-body text-primary-dark/70">No checked-in guests right now — a card exists only once someone has checked in.</p>
        ) : (
          <>
            <Select name="reservationId" label="Checked-In Guest" options={reservationOptions} value={selectedReservationId} onChange={setSelectedReservationId} />
            {lookupError ? <p className="text-small text-red-600">{lookupError}</p> : null}
            <Button type="button" disabled={!selectedReservationId} loading={lookupLoading} onClick={viewCard} className="self-start">
              View / Sign Card
            </Button>
          </>
        )}
      </Section>
    </Container>
  );
}

/**
 * A separate component, not `useEffect` + individual `setState` calls in
 * the parent — this only ever mounts once `templateQuery.data` is
 * already loaded (the parent renders it behind that same loading check),
 * so each field's `useState` can read its initial value directly off
 * `initial` with no sync effect needed at all (and no
 * `react-hooks/set-state-in-effect` lint violation from cascading renders
 * on every load).
 */
function TemplateForm({ initial, branchId, auth }: { initial: RegCardTemplate; branchId: string; auth: AuthOpts }) {
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl ?? '');
  const [houseRules, setHouseRules] = useState(initial.houseRules ?? '');
  const [language, setLanguage] = useState<string | null>(initial.language ?? null);
  const [showRate, setShowRate] = useState<'yes' | 'no'>(initial.showRate === false ? 'no' : 'yes');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setTemplateMutation = useSetRegCardTemplateMutation(branchId, auth);

  async function save() {
    setError(null);
    setSaved(false);
    try {
      await setTemplateMutation.mutateAsync({
        logoUrl: logoUrl.trim() || undefined,
        houseRules: houseRules.trim() || undefined,
        language: language ?? undefined,
        showRate: showRate === 'yes',
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        <Input name="logoUrl" label="Logo URL" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" />
        <Select id="language" name="language" label="Language" options={LANGUAGES} value={language} onChange={setLanguage} placeholder="Select language" />
      </div>
      <Textarea name="houseRules" label="House Rules" value={houseRules} onChange={(e) => setHouseRules(e.target.value)} hint="Printed on every generated card" />
      <YesNoToggle label="Show Rate on Card" name="showRate" value={showRate} onChange={setShowRate} />
      {error ? <p className="text-small text-red-600">{error}</p> : null}
      {saved ? <p className="text-small text-primary-dark">Template saved.</p> : null}
      <Button type="button" loading={setTemplateMutation.isPending} onClick={save} className="self-start">
        Save Template
      </Button>
    </>
  );
}
