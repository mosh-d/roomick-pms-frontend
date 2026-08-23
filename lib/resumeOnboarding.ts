import { apiFetch } from './api';
import type { AuthUser } from './store/authStore';
import type { WizardData, WizardStep, BranchDraft } from './store/wizardStore';
import type { BranchSetupFormValues } from './schemas/onboarding';

interface OnboardingStatus {
  tenant: { groupName: string; subdomain: string; country: string | null; brandMode: 'single' | 'multi' };
  user: { name: string; email: string; phone: string | null };
  brand: { id: string; name: string } | null;
  branch: {
    id: string;
    name: string;
    category: string | null;
    address: { street: string; city: string; state?: string; country: string; zip?: string };
    timezone: string;
    currency: string;
    checkInTime: string;
    checkOutTime: string;
  } | null;
  roomType: {
    id: string;
    name: string;
    baseRate: number;
    capacity: { adults: number; children: number };
    bedType: string | null;
    sizeM2: number | null;
    amenities: string[];
  } | null;
  roomCount: number;
}

/**
 * The "log in and continue where you left off" flow (`RegisterForm`'s
 * `SUBDOMAIN_TAKEN`/`EMAIL_TAKEN` handling) needs to rebuild wizardStore's
 * local draft from whatever the backend actually has — a fresh browser
 * session (or one that never got past account creation locally) has no way
 * to know a brand/branch/room type from an *earlier* session already exist.
 * Reused by name — `User.name` is one column, split back into first/last on
 * a best-effort basis (first space-separated token vs. the rest); the
 * backend never stored them separately, there's no way to recover the
 * original split exactly.
 *
 * **Known gap, carried forward on purpose (see PHASE_NOTES.md's "Full"
 * onboarding mode entry)**: this only ever reconstructs *one* branch, with
 * no buildings/floors and no individual room cards — `GET /tenants/me/
 * onboarding-status` (built before buildings/floors/multi-branch existed)
 * only reports a single branch/room-type pair and a room *count*, not a
 * tree. A returning owner past the Rooms step resumes onto Review with
 * that branch's room type showing but an empty Buildings section and a
 * room count of 0 locally, even though real rooms exist on the backend —
 * cosmetically wrong, not functionally unsafe: Finish's per-node
 * `if (!id)` guards mean nothing gets recreated, since no local room cards
 * exist to (re)submit in the first place. Extending the probe endpoint to
 * return the full tree is real, separate backend work, not attempted here.
 */
export async function resumeOnboardingDraft(
  accessToken: string,
  user: AuthUser,
): Promise<Partial<WizardData>> {
  const status = await apiFetch<OnboardingStatus>('/tenants/me/onboarding-status', {
    accessToken,
    tenantId: user.tenantId,
  });

  const [firstName, ...rest] = status.user.name.trim().split(/\s+/);
  const owner: WizardData['owner'] = {
    firstName: firstName ?? status.user.name,
    lastName: rest.join(' '),
    email: status.user.email,
    phone: status.user.phone ?? undefined,
    country: status.tenant.country ?? undefined,
    groupName: status.tenant.groupName,
    subdomain: status.tenant.subdomain,
  };

  const patch: Partial<WizardData> = {
    owner,
    accountCreated: true,
    registerDraft: null,
    emailVerified: true,
    loggedIn: true,
  };

  if (!status.brand) {
    return { ...patch, step: 'org-structure', branches: [] };
  }
  patch.brandMode = status.tenant.brandMode;
  patch.brandId = status.brand.id;

  if (!status.branch) {
    return { ...patch, step: 'branch-setup', branches: [] };
  }

  const branch: BranchDraft = {
    localId: crypto.randomUUID(),
    id: status.branch.id,
    name: status.branch.name,
    // The DB column is a free-form VARCHAR (schema.prisma's own comment
    // notes it's a convention, not a real enum) — cast, not validated,
    // since resuming trusts data this same wizard created in the first
    // place rather than re-running branchSetupSchema against it.
    category: (status.branch.category ?? undefined) as BranchSetupFormValues['category'],
    street: status.branch.address.street,
    city: status.branch.address.city,
    state: status.branch.address.state ?? '',
    country: status.branch.address.country,
    zip: status.branch.address.zip ?? '',
    timezone: status.branch.timezone,
    currency: status.branch.currency,
    checkInTime: status.branch.checkInTime,
    checkOutTime: status.branch.checkOutTime,
    roomTypes: [],
    buildings: [],
    rooms: [],
  };
  patch.branches = [branch];
  patch.activeBranchLocalId = branch.localId;

  if (!status.roomType) {
    return { ...patch, step: 'branch-setup' };
  }
  branch.roomTypes = [
    {
      localId: crypto.randomUUID(),
      id: status.roomType.id,
      name: status.roomType.name,
      baseRate: status.roomType.baseRate,
      adults: status.roomType.capacity.adults,
      children: status.roomType.capacity.children,
      bedType: status.roomType.bedType ?? '',
      sizeM2: status.roomType.sizeM2 ?? undefined,
      amenities: status.roomType.amenities,
    },
  ];

  const step: WizardStep = 'review';
  return { ...patch, step };
}
