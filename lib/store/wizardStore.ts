import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RegisterFormValues } from '@/lib/schemas/auth';
import type { BranchSetupFormValues, RoomTypeFormValues, BuildingFormValues } from '@/lib/schemas/onboarding';

export type SignupMode = 'demo' | 'real';
/** Maps directly to the backend's BrandMode enum ('single' | 'multi', confirmed in roomick-pms-backend/prisma/schema.prisma). */
export type BrandMode = 'single' | 'multi';
export type WizardStep =
  | 'register'
  | 'verify'
  | 'auto-login'
  | 'org-structure'
  | 'branch-setup'
  | 'buildings-floors'
  | 'room-type'
  | 'rooms'
  | 'staff-invite'
  | 'review'
  | 'complete';

// Draft shapes are the same types each step's own zod schema already
// infers (`lib/schemas/{auth,onboarding}.ts`), not hand-duplicated
// interfaces — importing them means this file can't quietly drift out of
// sync with the schema that actually validates the data.
export type OwnerAccountDraft = Omit<RegisterFormValues, 'password'>;
export interface StaffInviteDraft {
  email: string;
  roleId: string;
}

export interface InvitedStaff {
  email: string;
  roleName: string;
}

// `localId` (client-generated, `crypto.randomUUID()`) is what the sidebar
// tree, React `key`s, and cross-references between drafts (a room card
// pointing at "this floor" / "this room type") use before a node has a real
// backend id. `id` starts `null` and is written the moment Finish's chain
// actually creates that node — the same "id set on success, so a retry
// after a partial failure only creates what's still missing" pattern
// Phase 7 established for the single-branch case, now per-node.
export interface RoomTypeDraft extends RoomTypeFormValues {
  localId: string;
  id: string | null;
}

export interface FloorDraft {
  localId: string;
  id: string | null;
  floorNumber: number;
  label?: string;
}

export interface BuildingDraft extends Pick<BuildingFormValues, 'name' | 'views'> {
  localId: string;
  id: string | null;
  floors: FloorDraft[];
}

// A single room card — "Add room" appends one directly; "Generate" (the
// Setup Pattern modal) computes and appends many at once. Both end up as
// plain entries in the same list; nothing downstream needs to know which
// path created a given card. Grouped by (floorLocalId, roomTypeLocalId,
// view) at Finish time into `rooms/bulk` calls — see ReviewStep.
export interface RoomCardDraft {
  localId: string;
  id: string | null;
  floorLocalId: string;
  roomTypeLocalId: string;
  number: string;
  view?: string;
}

export interface BranchDraft extends BranchSetupFormValues {
  localId: string;
  id: string | null;
  roomTypes: RoomTypeDraft[];
  buildings: BuildingDraft[];
  rooms: RoomCardDraft[];
}

export interface WizardData {
  mode: SignupMode | null;
  step: WizardStep;

  // Owner Account Form + Verify Email + auto-login: these three still call
  // the backend immediately, unlike everything after — there's no way to
  // verify an email for an account that doesn't exist yet, so account
  // creation has to be a real, immediate step, not deferred draft state.
  // The flags below exist so navigating *back* to this phase and clicking
  // "Continue" again is pure navigation, not a re-submit — re-submitting
  // register() with the same subdomain/email a second time doesn't create
  // a second account, it just fails with SUBDOMAIN_TAKEN/EMAIL_TAKEN,
  // which is exactly the "stuck" bug this store exists to fix.
  owner: OwnerAccountDraft | null;
  accountCreated: boolean;
  verificationToken: string | null;
  emailVerified: boolean;
  loggedIn: boolean;
  // Live autosave target for the Owner Account form *before* it's
  // submitted — `owner` specifically means "the account was created with
  // these values" (drives RegisterForm's read-only mode), so a half-typed,
  // not-yet-submitted edit can't be written there without also looking
  // like a real account exists. Cleared once `accountCreated` flips true.
  // Password is never included here (see this file's persist comment).
  registerDraft: OwnerAccountDraft | null;

  // Everything from here on is pure local draft state — validated per step
  // (each step's own form still runs its own zod schema before advancing),
  // but never sent to the backend until Review's "Finish" fires the whole
  // chain at once. Going back to re-edit any of these is just changing
  // local state; nothing has been created on the backend to conflict with.
  //
  // One head brand per signup (unchanged, still singular) — multiple
  // *branches* under it, each carrying its own room types/buildings/rooms.
  // `activeBranchLocalId`/`activeBuildingLocalId`/`activeFloorLocalId` track
  // which node the wizard is currently editing, driving both the sidebar
  // tree's highlight and which branch's forms are actually shown — set
  // whenever the sidebar or an "Add"/"Continue" action moves focus.
  brandMode: BrandMode | null;
  branches: BranchDraft[];
  activeBranchLocalId: string | null;
  activeBuildingLocalId: string | null;
  activeFloorLocalId: string | null;
  staffInvites: StaffInviteDraft[];

  // Set only once Review's "Finish" actually runs the submission chain.
  brandId: string | null;
  invitedStaff: InvitedStaff[];
  staffInvitesSent: boolean;
}

const initialData: WizardData = {
  mode: null,
  step: 'register',
  owner: null,
  accountCreated: false,
  registerDraft: null,
  verificationToken: null,
  emailVerified: false,
  loggedIn: false,
  brandMode: null,
  branches: [],
  activeBranchLocalId: null,
  activeBuildingLocalId: null,
  activeFloorLocalId: null,
  staffInvites: [],
  brandId: null,
  invitedStaff: [],
  staffInvitesSent: false,
};

interface WizardState extends WizardData {
  patch: (partial: Partial<WizardData>) => void;
  reset: () => void;
}

/**
 * Persisted (localStorage) so the whole draft — and which step you're on —
 * survives a page reload, not just an in-session "back" click. Nothing in
 * here is as sensitive as a bearer token (see authStore.ts's own note on
 * why it now persists too, for the same "don't lose an in-progress signup
 * to an accidental refresh" reason) — form field values a person is about
 * to submit anyway. The one thing deliberately never stored here or
 * anywhere else: the owner's password. It's only ever held in a step
 * component's own transient state for the few seconds between register()
 * and AutoLoginStep's silent login() call, never in this persisted store.
 */
export const useWizardStore = create<WizardState>()(
  persist(
    (set) => ({
      ...initialData,
      patch: (partial) => set(partial),
      reset: () => set(initialData),
    }),
    { name: 'roomick-signup-draft' },
  ),
);
