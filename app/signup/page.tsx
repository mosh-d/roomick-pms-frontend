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
import { BranchSetupForm, emptyBranchDraft } from './_steps/BranchSetupForm';
import { BuildingsFloorsForm } from './_steps/BuildingsFloorsForm';
import { RoomTypeForm } from './_steps/RoomTypeForm';
import { RoomsForm } from './_steps/RoomsForm';
import { StaffInviteStep } from './_steps/StaffInviteStep';
import { ReviewStep } from './_steps/ReviewStep';
import { WizardShell, type WizardPhaseKey, type BranchTreeFocus } from './_steps/WizardShell';
import { useWizardStore, type WizardStep, type SignupMode, type BranchDraft } from '@/lib/store/wizardStore';
import { useAuthStore } from '@/lib/store/authStore';
import { useHasHydrated } from '@/lib/useHasHydrated';

/**
 * Maps this wizard's internal steps onto the 4 named phases the
 * reference's sidebar actually shows — see WizardShell.tsx's header
 * comment for why "Branch Setup" specifically is no longer a single flat
 * row (it's a real expandable tree now that "Full" onboarding mode exists).
 */
const PHASE_FOR_STEP: Record<WizardStep, WizardPhaseKey> = {
  register: 'owner',
  verify: 'owner',
  'auto-login': 'owner',
  'org-structure': 'org',
  'branch-setup': 'branch',
  'buildings-floors': 'branch',
  'room-type': 'branch',
  rooms: 'branch',
  'staff-invite': 'branch',
  review: 'review',
  complete: 'review',
};

/** The step `WizardShell`'s sidebar navigates to when a passed phase's plain row (not one of the branch tree's own rows) is clicked. */
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
  'buildings-floors': 'Set up buildings and floors for this property.',
  'room-type': 'Set up room types for this property.',
  rooms: 'Set up individual rooms.',
  'staff-invite': 'Invite your first staff members, or skip for now.',
  review: 'Review everything before you finish.',
  complete: "You're all set.",
};

/** Every floor across every building of a branch, in building/floor order — what "Continue" from Rooms walks through, and what a fresh branch needs at least one of before Room Types can lead anywhere. */
function flattenFloors(branch: BranchDraft): { buildingLocalId: string; floorLocalId: string }[] {
  return branch.buildings.flatMap((building) => building.floors.map((floor) => ({ buildingLocalId: building.localId, floorLocalId: floor.localId })));
}

/**
 * The full onboarding wizard (Roomick-UI.pdf), one screen at a time:
 * demo/real choice → Owner Account → Verify Email → (silent auto-login,
 * see AutoLoginStep) → Organization Structure → Branch Setup → Buildings/
 * Floors → Room Types → Rooms (once per floor) → Staff Invite → Review →
 * done. "Full" onboarding mode (see PHASE_NOTES.md) — multiple branches,
 * real buildings/floors, multiple room types per branch, individual room
 * cards — replaces the earlier "Rooms Only" single-branch shortcut.
 *
 * Deferred submission (see PHASE_NOTES.md for the full write-up): Owner
 * Account + Verify Email + auto-login still submit immediately — creating
 * a real account is a real gate, there's no verifying an email for an
 * account that doesn't exist. Everything from Organization Structure
 * onward is pure local state (`wizardStore`, persisted to localStorage)
 * until Review's "Finish" fires the whole remaining chain at once.
 *
 * Staff invite and Review stay singular, not per-branch — the reference
 * shows Staff Invite once per onboarding pass and a paginated Review, but
 * multi-branch staff invites would need `staffInvites` nested per branch
 * too, a further data-model change not required by the actual request
 * ("multiple branches and room types"); the first branch created is the
 * one Finish sends any invites against. See PHASE_NOTES.md's carried-
 * forward note.
 */
function SignupPageInner() {
  const searchParams = useSearchParams();
  const demoParam = searchParams.get('demo');

  const wizardHydrated = useHasHydrated(useWizardStore);
  const authHydrated = useHasHydrated(useAuthStore);

  const mode = useWizardStore((state) => state.mode);
  const step = useWizardStore((state) => state.step);
  const ownerEmail = useWizardStore((state) => state.owner?.email);
  const branches = useWizardStore((state) => state.branches);
  const activeBranchLocalId = useWizardStore((state) => state.activeBranchLocalId);
  const activeBuildingLocalId = useWizardStore((state) => state.activeBuildingLocalId);
  const activeFloorLocalId = useWizardStore((state) => state.activeFloorLocalId);
  const patch = useWizardStore((state) => state.patch);

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

  function goToBranch(branchLocalId: string) {
    patch({ step: 'branch-setup', activeBranchLocalId: branchLocalId });
  }

  function goToRoomTypes(branchLocalId: string) {
    patch({ step: 'room-type', activeBranchLocalId: branchLocalId });
  }

  function goToBuildings(branchLocalId: string) {
    patch({ step: 'buildings-floors', activeBranchLocalId: branchLocalId });
  }

  function goToFloor(branchLocalId: string, buildingLocalId: string, floorLocalId: string) {
    patch({ step: 'rooms', activeBranchLocalId: branchLocalId, activeBuildingLocalId: buildingLocalId, activeFloorLocalId: floorLocalId });
  }

  function addBranch() {
    const draft = emptyBranchDraft();
    patch({ branches: [...branches, draft], step: 'branch-setup', activeBranchLocalId: draft.localId });
  }

  function removeBranch(branchLocalId: string) {
    const remaining = branches.filter((b) => b.localId !== branchLocalId);
    const stillActive = activeBranchLocalId === branchLocalId ? (remaining[0]?.localId ?? null) : activeBranchLocalId;
    patch({ branches: remaining, activeBranchLocalId: stillActive });
  }

  /**
   * After a floor's rooms are saved: move to the next floor in this
   * branch if one exists, otherwise this branch's room setup is done —
   * the *first* branch created continues on to Staff Invite (still a
   * once-per-onboarding step, not per-branch); any branch added after
   * that goes straight back to Review, since Staff Invite was already
   * handled once.
   */
  function afterRoomsSaved() {
    const branch = branches.find((b) => b.localId === activeBranchLocalId);
    const floors = branch ? flattenFloors(branch) : [];
    const currentIndex = floors.findIndex((f) => f.floorLocalId === activeFloorLocalId);
    const next = floors[currentIndex + 1];
    if (next) {
      patch({ activeBuildingLocalId: next.buildingLocalId, activeFloorLocalId: next.floorLocalId });
      return;
    }
    const isFirstBranch = branches[0]?.localId === activeBranchLocalId;
    goTo(isFirstBranch ? 'staff-invite' : 'review');
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

  const branchTreeFocus: BranchTreeFocus =
    step === 'branch-setup' && activeBranchLocalId
      ? { kind: 'branch', branchLocalId: activeBranchLocalId }
      : step === 'room-type' && activeBranchLocalId
        ? { kind: 'room-types', branchLocalId: activeBranchLocalId }
        : step === 'buildings-floors' && activeBranchLocalId
          ? { kind: 'buildings', branchLocalId: activeBranchLocalId }
          : step === 'rooms' && activeBranchLocalId && activeBuildingLocalId && activeFloorLocalId
            ? { kind: 'floor', branchLocalId: activeBranchLocalId, buildingLocalId: activeBuildingLocalId, floorLocalId: activeFloorLocalId }
            : null;

  return (
    <WizardShell
      currentPhase={PHASE_FOR_STEP[step]}
      onNavigate={(phase) => goTo(FIRST_STEP_FOR_PHASE[phase])}
      branches={branches}
      branchTreeFocus={branchTreeFocus}
      onSelectBranch={goToBranch}
      onSelectRoomTypes={goToRoomTypes}
      onSelectBuildings={goToBuildings}
      onSelectFloor={goToFloor}
      onAddBranch={addBranch}
      onRemoveBranch={removeBranch}
    >
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

        {step === 'branch-setup' ? (
          <BranchSetupForm onBack={() => goTo('org-structure')} onNext={() => goTo('buildings-floors')} />
        ) : null}

        {step === 'buildings-floors' ? (
          <BuildingsFloorsForm onBack={() => goTo('branch-setup')} onNext={() => goTo('room-type')} />
        ) : null}

        {step === 'room-type' ? (
          <RoomTypeForm
            onBack={() => goTo('buildings-floors')}
            onNext={() => {
              const branch = branches.find((b) => b.localId === activeBranchLocalId);
              const firstFloor = branch ? flattenFloors(branch)[0] : undefined;
              if (firstFloor) {
                patch({ step: 'rooms', activeBuildingLocalId: firstFloor.buildingLocalId, activeFloorLocalId: firstFloor.floorLocalId });
              } else {
                goTo('staff-invite');
              }
            }}
          />
        ) : null}

        {step === 'rooms' ? <RoomsForm onBack={() => goTo('room-type')} onNext={afterRoomsSaved} /> : null}

        {step === 'staff-invite' ? (
          <StaffInviteStep onBack={() => goTo('rooms')} onNext={() => goTo('review')} />
        ) : null}

        {step === 'review' ? <ReviewStep onBack={() => goTo('staff-invite')} onFinish={() => goTo('complete')} /> : null}

        {step === 'complete' ? <CompleteStep /> : null}
      </Container>
    </WizardShell>
  );
}

function CompleteStep() {
  const owner = useWizardStore((state) => state.owner);
  const branches = useWizardStore((state) => state.branches);
  const resetWizard = useWizardStore((state) => state.reset);
  const clearAuth = useAuthStore((state) => state.clear);

  const roomCount = branches.reduce((sum, b) => sum + b.rooms.length, 0);

  return (
    <Section label="Setup complete">
      <p className="text-body text-secondary">
        <span className="font-semibold">{owner?.subdomain}</span> is ready — {branches.length} branch
        {branches.length === 1 ? '' : 'es'}, {branches.reduce((sum, b) => sum + b.roomTypes.length, 0)} room type
        {branches.reduce((sum, b) => sum + b.roomTypes.length, 0) === 1 ? '' : 's'}, and {roomCount} room
        {roomCount === 1 ? '' : 's'} are all set up. A front-desk/operations dashboard is the next phase of this
        project — see <code className="text-tiny">PHASE_NOTES.md</code>.
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
