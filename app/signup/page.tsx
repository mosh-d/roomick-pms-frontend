'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { RadioCard } from '@/components/ui/RadioCard';
import { RegisterForm } from './_steps/RegisterForm';
import { VerifyEmailForm } from './_steps/VerifyEmailForm';
import { AutoLoginStep } from './_steps/AutoLoginStep';
import { OrgStructureForm } from './_steps/OrgStructureForm';
import { BranchSetupForm } from './_steps/BranchSetupForm';
import { RoomTypeForm } from './_steps/RoomTypeForm';
import { RoomsForm } from './_steps/RoomsForm';
import { StaffInviteStep } from './_steps/StaffInviteStep';
import { ReviewStep } from './_steps/ReviewStep';
import { WizardShell, type WizardPhaseKey } from './_steps/WizardShell';
import { useWizardStore, type WizardStep, type SignupMode } from '@/lib/store/wizardStore';
import { useAuthStore } from '@/lib/store/authStore';
import { useHasHydrated } from '@/lib/useHasHydrated';

/**
 * Maps this wizard's ~10 fine-grained internal steps onto the 4 named
 * phases the reference's sidebar actually shows — its own "Branch Setup"
 * page bundles Property Details + Tax Rules + Staff Invite into one phase,
 * for example, so several internal steps legitimately collapse into one
 * sidebar entry. See WizardShell.tsx's header comment.
 */
const PHASE_FOR_STEP: Record<WizardStep, WizardPhaseKey> = {
  register: 'owner',
  verify: 'owner',
  'auto-login': 'owner',
  'org-structure': 'org',
  'branch-setup': 'branch',
  'room-type': 'branch',
  rooms: 'branch',
  'staff-invite': 'branch',
  review: 'review',
  complete: 'review',
};

/** The step `WizardShell`'s sidebar navigates to when a passed phase is clicked — always that phase's first internal step. */
const FIRST_STEP_FOR_PHASE: Record<WizardPhaseKey, WizardStep> = {
  owner: 'register',
  org: 'org-structure',
  branch: 'branch-setup',
  review: 'review',
};

const STEP_LABELS: Record<WizardStep, string> = {
  register: 'Set up your organization and owner account.',
  verify: 'Confirm your email to finish setting up your account.',
  'auto-login': 'Signing you in…',
  'org-structure': 'How is your organization structured?',
  'branch-setup': 'Tell us about your property.',
  'room-type': 'Add your first room type.',
  rooms: 'Create your first rooms.',
  'staff-invite': 'Invite your first staff members, or skip for now.',
  review: 'Review everything before you finish.',
  complete: "You're all set.",
};

/**
 * The full onboarding wizard (Roomick-UI.pdf), one screen at a time:
 * demo/real choice → Owner Account → Verify Email → (silent auto-login,
 * see AutoLoginStep) → Organization Structure → Branch Setup → Room Type →
 * Rooms → Staff Invite → Review → done.
 *
 * Deferred submission (see PHASE_NOTES.md for the full write-up): Owner
 * Account + Verify Email + auto-login still submit immediately — creating
 * a real account is a real gate, there's no verifying an email for an
 * account that doesn't exist. Everything from Organization Structure
 * onward is pure local state (`wizardStore`, persisted to localStorage)
 * until Review's "Finish" fires the whole remaining chain at once. That's
 * what fixes the two problems the previous "submit every step immediately"
 * design had: going back to re-check or fix something no longer
 * re-triggers an already-succeeded API call (there's nothing to conflict
 * with — nothing's been created yet), and a page reload doesn't lose
 * anything either.
 *
 * Buildings/floors ("Full" onboarding mode) and multiple room types/room
 * batches are deliberately not built here — the backend's rooms/bulk
 * endpoint has a documented "Rooms Only" mode (skip floorId entirely, a
 * hidden default building/floor is auto-created) that this wizard uses, and
 * managing more than one room type is future Room Types management screen
 * work, not first-run onboarding. Tax rule configuration and logo upload
 * are skipped for a different reason — no backend endpoint exists for
 * either yet, confirmed by checking, not assumed. See PHASE_NOTES.md.
 */
function SignupPageInner() {
  const searchParams = useSearchParams();
  const demoParam = searchParams.get('demo');

  // `persist` hydrates from localStorage asynchronously, after the first
  // render — without this guard, a reload briefly renders `mode === null`
  // (the demo/real choice screen) using the store's un-hydrated initial
  // state before snapping to whatever step was actually saved, which reads
  // as a real bug ("I see a brief create-your-account screen on reload"),
  // not just a cosmetic flicker. See useHasHydrated.ts.
  const wizardHydrated = useHasHydrated(useWizardStore);
  const authHydrated = useHasHydrated(useAuthStore);

  const mode = useWizardStore((state) => state.mode);
  const step = useWizardStore((state) => state.step);
  const ownerEmail = useWizardStore((state) => state.owner?.email);
  const patch = useWizardStore((state) => state.patch);

  // Never persisted (see wizardStore.ts's header comment on why the
  // password specifically stays out of the store) — held here just long
  // enough to hand off from RegisterForm to AutoLoginStep.
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (mode === null && (demoParam === 'true' || demoParam === 'false')) {
      patch({ mode: demoParam === 'true' ? 'demo' : 'real' });
    }
  }, [demoParam, mode, patch]);

  function setMode(next: SignupMode | null) {
    patch({ mode: next });
  }

  function goTo(next: WizardStep) {
    patch({ step: next });
  }

  if (!wizardHydrated || !authHydrated) return null;

  if (mode === null) {
    return (
      <Container className="max-w-xl py-16">
        <h1 className="text-title font-bold text-secondary mb-2">Create your Roomick account</h1>
        <p className="text-body text-secondary-light mb-8">
          Try it out risk-free, or get started for real — same setup either way.
        </p>
        <RadioCard
          name="signupMode"
          tone="secondary"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'demo', title: 'Try a demo' },
            { value: 'real', title: 'Get started' },
          ]}
        />
      </Container>
    );
  }

  return (
    <WizardShell currentPhase={PHASE_FOR_STEP[step]} onNavigate={(phase) => goTo(FIRST_STEP_FOR_PHASE[phase])}>
      <Container className="max-w-xl py-0">
        <h1 className="text-title font-bold text-secondary mb-2">Create your Roomick account</h1>
        <p className="text-body text-secondary-light mb-8">{STEP_LABELS[step]}</p>

        {step === 'register' ? (
          <RegisterForm
            isDemo={mode === 'demo'}
            onNext={(creds) => {
              setPassword(creds.password);
              goTo('verify');
            }}
          />
        ) : null}

        {step === 'verify' ? <VerifyEmailForm onNext={() => goTo('auto-login')} /> : null}

        {step === 'auto-login' ? (
          <AutoLoginStep email={ownerEmail ?? ''} password={password} onSuccess={() => goTo('org-structure')} />
        ) : null}

        {step === 'org-structure' ? <OrgStructureForm onNext={() => goTo('branch-setup')} /> : null}

        {step === 'branch-setup' ? <BranchSetupForm onNext={() => goTo('room-type')} /> : null}

        {step === 'room-type' ? <RoomTypeForm onNext={() => goTo('rooms')} /> : null}

        {step === 'rooms' ? <RoomsForm onNext={() => goTo('staff-invite')} /> : null}

        {step === 'staff-invite' ? <StaffInviteStep onNext={() => goTo('review')} /> : null}

        {step === 'review' ? <ReviewStep onFinish={() => goTo('complete')} /> : null}

        {step === 'complete' ? <CompleteStep /> : null}
      </Container>
    </WizardShell>
  );
}

function CompleteStep() {
  const owner = useWizardStore((state) => state.owner);
  const createdRoomCount = useWizardStore((state) => state.createdRoomCount);
  const resetWizard = useWizardStore((state) => state.reset);
  const clearAuth = useAuthStore((state) => state.clear);

  return (
    <Section label="Setup complete">
      <p className="text-body text-secondary">
        <span className="font-semibold">{owner?.subdomain}</span> is ready — organization, branch, room type, and{' '}
        {createdRoomCount} room{createdRoomCount === 1 ? '' : 's'} are all set up. A front-desk/operations
        dashboard is the next phase of this project — see <code className="text-tiny">PHASE_NOTES.md</code>.
      </p>
      <button
        type="button"
        onClick={() => {
          resetWizard();
          clearAuth();
        }}
        className="text-body text-secondary-light hover:text-secondary underline cursor-pointer self-start"
      >
        Start a new signup
      </button>
    </Section>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupPageInner />
    </Suspense>
  );
}
