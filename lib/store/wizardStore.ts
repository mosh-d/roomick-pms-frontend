import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BrandMode } from '@/components/ui/BrandRadioCard';
import type { RegisterFormValues } from '@/lib/schemas/auth';
import type { BranchSetupFormValues, RoomTypeFormValues, RoomsBulkFormValues } from '@/lib/schemas/onboarding';

export type SignupMode = 'demo' | 'real';
export type WizardStep =
  | 'register'
  | 'verify'
  | 'auto-login'
  | 'org-structure'
  | 'branch-setup'
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
export type BranchDraft = BranchSetupFormValues;
export type RoomTypeDraft = RoomTypeFormValues;
export type RoomsDraft = RoomsBulkFormValues;
export interface StaffInviteDraft {
  email: string;
  roleId: string;
}

export interface InvitedStaff {
  email: string;
  roleName: string;
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
  brandMode: BrandMode | null;
  branch: BranchDraft | null;
  roomType: RoomTypeDraft | null;
  rooms: RoomsDraft | null;
  staffInvites: StaffInviteDraft[];

  // Set only once Review's "Finish" actually runs the submission chain.
  // Tracked individually (not just a single "submitted" boolean) so a
  // failure partway through — e.g. branch creation succeeds but room-type
  // creation fails — can be retried without re-running the steps that
  // already succeeded.
  brandId: string | null;
  branchId: string | null;
  roomTypeId: string | null;
  createdRoomCount: number;
  // `invitedStaff` is populated at StaffInviteStep time already (resolved
  // role names for Review's preview, before anything is actually sent) —
  // this flag is what actually distinguishes "previewed" from "sent",
  // since `invitedStaff.length > 0` can no longer be used for that once
  // it's set before submission too.
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
  branch: null,
  roomType: null,
  rooms: null,
  staffInvites: [],
  brandId: null,
  branchId: null,
  roomTypeId: null,
  createdRoomCount: 0,
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
