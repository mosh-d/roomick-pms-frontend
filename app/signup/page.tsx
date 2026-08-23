'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { RadioCard } from '@/components/ui/RadioCard';
import type { BrandMode } from '@/components/ui/BrandRadioCard';
import { RegisterForm, type RegisterResponse } from './_steps/RegisterForm';
import { VerifyEmailForm } from './_steps/VerifyEmailForm';
import { AutoLoginStep } from './_steps/AutoLoginStep';
import { OrgStructureForm } from './_steps/OrgStructureForm';
import { CreateBrandStep } from './_steps/CreateBrandStep';
import { BranchSetupForm, type BranchResponse } from './_steps/BranchSetupForm';
import { RoomTypeForm, type RoomTypeResponse } from './_steps/RoomTypeForm';
import { RoomsForm } from './_steps/RoomsForm';
import { StaffInviteStep, type InvitedStaff } from './_steps/StaffInviteStep';
import { ReviewStep, type ReviewSummary } from './_steps/ReviewStep';
import { WizardShell, type WizardPhaseKey } from './_steps/WizardShell';

type SignupMode = 'demo' | 'real';
type WizardStep =
  | 'register'
  | 'verify'
  | 'auto-login'
  | 'org-structure'
  | 'create-brand'
  | 'branch-setup'
  | 'room-type'
  | 'rooms'
  | 'staff-invite'
  | 'review'
  | 'complete';

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
  'create-brand': 'org',
  'branch-setup': 'branch',
  'room-type': 'branch',
  rooms: 'branch',
  'staff-invite': 'branch',
  review: 'review',
  complete: 'review',
};

const STEP_LABELS: Record<WizardStep, string> = {
  register: 'Set up your organization and owner account.',
  verify: 'Confirm your email to finish setting up your account.',
  'auto-login': 'Signing you in…',
  'org-structure': 'How is your organization structured?',
  'create-brand': 'Name your first brand.',
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
 * Rooms → Staff Invite → Review → done. Each step's form component owns its
 * own DTO-exact schema and API call; this file only owns the step sequence
 * and the data handed from one step to the next (brandId, branchId,
 * roomTypeId, invited staff, …).
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
  const initialMode: SignupMode | null = demoParam === 'true' ? 'demo' : demoParam === 'false' ? 'real' : null;

  const [mode, setMode] = useState<SignupMode | null>(initialMode);
  const [step, setStep] = useState<WizardStep>('register');

  const [registered, setRegistered] = useState<RegisterResponse | null>(null);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const [brandMode, setBrandMode] = useState<BrandMode | null>(null);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [branch, setBranch] = useState<BranchResponse | null>(null);
  const [roomType, setRoomType] = useState<RoomTypeResponse | null>(null);
  const [roomCount, setRoomCount] = useState(0);
  const [invitedStaff, setInvitedStaff] = useState<InvitedStaff[]>([]);

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
    <WizardShell currentPhase={PHASE_FOR_STEP[step]}>
      <Container className="max-w-xl py-0">
        <h1 className="text-title font-bold text-secondary mb-2">Create your Roomick account</h1>
        <p className="text-body text-secondary-light mb-8">{STEP_LABELS[step]}</p>

        {step === 'register' ? (
          <RegisterForm
            isDemo={mode === 'demo'}
            onSuccess={(result, creds) => {
              setRegistered(result);
              setCredentials(creds);
              setStep('verify');
            }}
          />
        ) : null}

        {step === 'verify' && registered ? (
          <VerifyEmailForm
            subdomain={registered.subdomain}
            initialToken={registered.verificationToken}
            onSuccess={() => setStep('auto-login')}
          />
        ) : null}

        {step === 'auto-login' && registered && credentials ? (
          <AutoLoginStep
            email={credentials.email}
            password={credentials.password}
            subdomain={registered.subdomain}
            onSuccess={() => setStep('org-structure')}
          />
        ) : null}

        {step === 'org-structure' ? (
          <OrgStructureForm
            onSuccess={({ mode: resolvedMode, brandId: resolvedBrandId }) => {
              setBrandMode(resolvedMode);
              if (resolvedBrandId) {
                setBrandId(resolvedBrandId);
                setStep('branch-setup');
              } else {
                setStep('create-brand');
              }
            }}
          />
        ) : null}

        {step === 'create-brand' ? (
          <CreateBrandStep
            onSuccess={(id) => {
              setBrandId(id);
              setStep('branch-setup');
            }}
          />
        ) : null}

        {step === 'branch-setup' && brandId ? (
          <BranchSetupForm
            brandId={brandId}
            onSuccess={(result) => {
              setBranch(result);
              setStep('room-type');
            }}
          />
        ) : null}

        {step === 'room-type' && branch ? (
          <RoomTypeForm
            branchId={branch.id}
            onSuccess={(result) => {
              setRoomType(result);
              setStep('rooms');
            }}
          />
        ) : null}

        {step === 'rooms' && branch && roomType ? (
          <RoomsForm
            branchId={branch.id}
            roomTypeId={roomType.id}
            onSuccess={(rooms) => {
              setRoomCount(rooms.length);
              setStep('staff-invite');
            }}
          />
        ) : null}

        {step === 'staff-invite' && branch ? (
          <StaffInviteStep
            branchId={branch.id}
            onDone={(invited) => {
              setInvitedStaff(invited);
              setStep('review');
            }}
          />
        ) : null}

        {step === 'review' && registered && brandMode && branch && roomType ? (
          <ReviewStep
            summary={buildSummary(registered, brandMode, branch, roomType, roomCount, invitedStaff)}
            onFinish={() => setStep('complete')}
          />
        ) : null}

        {step === 'complete' ? (
          <Section label="Setup complete">
            <p className="text-body text-secondary">
              <span className="font-semibold">{registered?.subdomain}</span> is ready — organization, branch, room
              type, and {roomCount} room{roomCount === 1 ? '' : 's'} are all set up. A front-desk/operations
              dashboard is the next phase of this project — see <code className="text-tiny">PHASE_NOTES.md</code>.
            </p>
          </Section>
        ) : null}
      </Container>
    </WizardShell>
  );
}

function buildSummary(
  registered: RegisterResponse,
  brandMode: BrandMode,
  branch: BranchResponse,
  roomType: RoomTypeResponse,
  roomCount: number,
  invitedStaff: InvitedStaff[],
): ReviewSummary {
  return {
    subdomain: registered.subdomain,
    brandMode,
    branchName: branch.name,
    branchCategory: branch.category ?? undefined,
    currency: branch.currency,
    timezone: branch.timezone,
    roomTypeName: roomType.name,
    baseRate: roomType.baseRate,
    roomCount,
    invitedStaff,
  };
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupPageInner />
    </Suspense>
  );
}
