'use client';

import { useMemo, useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { Modal } from '@/components/ui/Modal';
import { Table, type TableColumn } from '@/components/ui/Table';
import { PageHeader } from '@/components/ui/PageHeader';
import { BackButton } from '@/components/ui/BackButton';
import {
  grantableRoles,
  useBulkInviteMutation,
  useCancelInviteMutation,
  usePasswordResetLinkMutation,
  usePatchStaffMutation,
  useRolesQuery,
  useStaffInvitesQuery,
  useStaffQuery,
  type InviteResult,
  type PendingInvite,
  type StaffMember,
} from '@/lib/staff';
import { usePageAccessQuery, useResetRolePagesMutation, useSetRolePagesMutation, type PageAccessMatrix, type RolePageAccess } from '@/lib/pageAccess';
import { useResetStaffMfaMutation } from '@/lib/mfa';
import { useMyBranches } from '@/lib/dashboardBranches';
import { roleLabel } from '@/lib/roles';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

const errorText = (err: unknown) => (err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** A link to pass on: emailed already, or to copy and send yourself. */
function LinkToHandOver({ id, emailed, email, link, emailedText, handOverText }: { id: string; emailed: boolean; email: string; link: string; emailedText: string; handOverText: string }) {
  return (
    <div className="flex flex-col gap-2" id={id}>
      <p className="text-small text-surface">{emailed ? emailedText : handOverText}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 min-w-0 rounded-control border border-primary/30 surface-page bg-white px-3 py-2 text-tiny text-surface break-all">{link}</code>
        <CopyButton value={link} label="Copy link" />
      </div>
      {emailed ? null : <p className="text-tiny text-surface-muted">Send it to {email} by message, or open it on their phone. Anyone with the link can use it, so send it only to them.</p>}
    </div>
  );
}

function InviteStaffModal({ open, onClose, branchId, auth }: { open: boolean; onClose: () => void; branchId: string; auth: AuthOpts }) {
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<InviteResult | null>(null);
  const rolesQuery = useRolesQuery(auth);
  const inviteMutation = useBulkInviteMutation(branchId, auth);
  const isOwner = useAuthStore((s) => s.user?.roles.some((r) => r.role === 'owner') ?? false);

  const roleOptions: SelectOption[] = grantableRoles(rolesQuery.data ?? [], isOwner).map((r) => ({ value: r.id, label: roleLabel(r.name) }));

  function close() {
    setEmail('');
    setRoleId(null);
    setError(null);
    setSent(null);
    onClose();
  }

  async function handleSubmit() {
    if (!email || !roleId) return;
    setError(null);
    try {
      const [result] = await inviteMutation.mutateAsync([{ email: email.trim().toLowerCase(), roleId }]);
      setSent(result ?? null);
    } catch (err) {
      setError(errorText(err));
    }
  }

  if (!open) return null;

  if (sent) {
    return (
      <Modal open={open} onClose={close} title="Invitation Ready">
        <LinkToHandOver
          id="invite-link"
          emailed={sent.emailed}
          email={sent.email}
          link={sent.link}
          emailedText={`Invitation emailed to ${sent.email}. The link works for 72 hours — it’s here too in case it doesn’t arrive.`}
          handOverText={`Email isn’t set up on this system yet, so send ${sent.email} this link yourself. It works for 72 hours.`}
        />
        <div className="flex items-center gap-3">
          <Button type="button" onClick={close}>
            Done
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={close} title="Invite Staff">
      <Input id="invite-staff-email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error ?? undefined} />
      <Select id="invite-staff-role" label="Role" options={roleOptions} value={roleId} onChange={setRoleId} placeholder="Select a role" />
      {isOwner ? null : <p className="text-tiny text-surface-muted">Only the owner can invite a manager.</p>}
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" onClick={close}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={inviteMutation.isPending || !email || !roleId}>
          {inviteMutation.isPending ? 'Sending…' : 'Send Invite'}
        </Button>
      </div>
    </Modal>
  );
}

/** A password-reset link for a colleague who's locked out — shown once, to hand over. */
function ResetLinkModal({ member, onClose, auth }: { member: StaffMember | null; onClose: () => void; auth: AuthOpts }) {
  const resetLink = usePasswordResetLinkMutation(auth);
  const [error, setError] = useState<string | null>(null);

  function close() {
    resetLink.reset();
    setError(null);
    onClose();
  }

  if (!member) return null;

  return (
    <Modal open onClose={close} title="Password Reset Link">
      {resetLink.data ? (
        <LinkToHandOver
          id="reset-link"
          emailed={resetLink.data.emailed}
          email={member.email}
          link={resetLink.data.link}
          emailedText={`Emailed to ${member.email}. The link works once, for 24 hours — it’s here too in case it doesn’t arrive.`}
          handOverText={`Email isn’t set up on this system yet, so give ${member.name} this link yourself. It works once, for 24 hours.`}
        />
      ) : (
        <p className="text-small text-surface">
          For when {member.name} can’t sign in. The link lets them choose a new password, and signs them out everywhere they’re signed in. Their two-step
          sign-in stays as it is.
        </p>
      )}
      {error ? <p className="text-small text-red-600">{error}</p> : null}
      <div className="flex items-center gap-3">
        {resetLink.data ? (
          <Button type="button" onClick={close}>
            Done
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button
              type="button"
              loading={resetLink.isPending}
              onClick={() => {
                setError(null);
                resetLink.mutate(member.id, { onError: (err) => setError(errorText(err)) });
              }}
            >
              Make Link
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}

/** Who works at this branch: their role, last sign-in, two-step sign-in and whether they can still sign in. */
function StaffSection({ branchId, auth }: { branchId: string; auth: AuthOpts }) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [resetFor, setResetFor] = useState<StaffMember | null>(null);
  const staffQuery = useStaffQuery(branchId, auth);
  const patchStaffMutation = usePatchStaffMutation(branchId, auth);
  const resetMfa = useResetStaffMfaMutation(auth);
  const me = useAuthStore((s) => s.user);
  const isOwner = me?.roles.some((r) => r.role === 'owner') ?? false;
  const [mfaMessage, setMfaMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const columns: TableColumn<StaffMember>[] = [
    { key: 'name', label: 'Name', render: (s) => s.name, sortValue: (s) => s.name },
    { key: 'email', label: 'Email', render: (s) => s.email, sortValue: (s) => s.email },
    {
      key: 'role',
      label: 'Role',
      render: (s) => (
        <div className="flex flex-wrap gap-1">
          {s.roles.map((r) => (
            <span key={`${r.roleId}-${r.branchId ?? 'all'}`} className="inline-flex items-center rounded-pill bg-secondary-light/20 text-secondary px-2.5 py-0.5 text-tiny font-semibold">
              {roleLabel(r.role)}
            </span>
          ))}
        </div>
      ),
      sortValue: (s) => s.roles[0]?.role ?? '',
      exportValue: (s) => s.roles.map((r) => roleLabel(r.role)).join(', '),
    },
    {
      key: 'lastLoginAt',
      label: 'Last Login',
      render: (s) => (s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleString() : 'Never'),
      sortValue: (s) => s.lastLoginAt ?? '',
    },
    {
      key: 'mfa',
      label: 'Two-Step',
      render: (s) =>
        s.mfaEnabled ? (
          <div className="flex items-center gap-2">
            <span className="text-small text-green-700 font-semibold">On</span>
            {isOwner && s.id !== me?.id ? (
              <Button
                size="sm"
                variant="outline"
                disabled={resetMfa.isPending}
                onClick={() => {
                  setMfaMessage(null);
                  resetMfa.mutate(s.id, {
                    onSuccess: () => setMfaMessage(`Two-step sign-in reset for ${s.name}. They sign in with their password and can set it up again from My Account.`),
                    onError: (err) => setMfaMessage(err instanceof ApiError ? err.message : 'Couldn’t reset it.'),
                  });
                }}
              >
                Reset
              </Button>
            ) : null}
          </div>
        ) : (
          <span className="text-small text-surface/70">Off</span>
        ),
      sortValue: (s) => (s.mfaEnabled ? 1 : 0),
    },
    {
      key: 'active',
      label: 'Status',
      render: (s) =>
        s.canManageAccount ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setStatusError(null);
              patchStaffMutation.mutate({ userId: s.id, active: !s.active }, { onError: (err) => setStatusError(errorText(err)) });
            }}
            disabled={patchStaffMutation.isPending}
          >
            {s.active ? 'Active — Deactivate' : 'Inactive — Reactivate'}
          </Button>
        ) : (
          <span className="text-small text-surface" title={s.id === me?.id ? 'That’s you' : 'Only the owner can change this account'}>
            {s.active ? 'Active' : 'Inactive'}
          </span>
        ),
      sortValue: (s) => (s.active ? 1 : 0),
      exportValue: (s) => (s.active ? 'Active' : 'Inactive'),
    },
    {
      key: 'password',
      label: 'Password',
      render: (s) =>
        s.canManageAccount && s.active ? (
          <Button size="sm" variant="outline" onClick={() => setResetFor(s)}>
            Reset Link
          </Button>
        ) : (
          <span className="text-small text-surface-muted">—</span>
        ),
    },
  ];

  return (
    <Section label="Staff">
      <div className="flex flex-col gap-3">
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            Invite Staff
          </Button>
        </div>
        {staffQuery.isLoading ? null : (
          <Card tone="secondary">
            <Table columns={columns} rows={staffQuery.data ?? []} emptyMessage="No staff at this branch yet." exportFileName="staff" />
            {statusError ? (
              <p className="text-small text-red-600 mt-2" id="staff-status-error">
                {statusError}
              </p>
            ) : null}
            {mfaMessage ? (
              <p className="text-small text-surface mt-2" id="staff-mfa-message">
                {mfaMessage}
              </p>
            ) : null}
          </Card>
        )}
      </div>
      <InviteStaffModal open={inviteOpen} onClose={() => setInviteOpen(false)} branchId={branchId} auth={auth} />
      <ResetLinkModal member={resetFor} onClose={() => setResetFor(null)} auth={auth} />
    </Section>
  );
}

/** Invitations nobody has accepted yet: copy the link again, send a fresh one, or withdraw it. */
function PendingInvitesSection({ branchId, auth }: { branchId: string; auth: AuthOpts }) {
  const invitesQuery = useStaffInvitesQuery(branchId, auth);
  const resend = useBulkInviteMutation(branchId, auth);
  const cancel = useCancelInviteMutation(branchId, auth);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const invites = invitesQuery.data ?? [];

  if (invites.length === 0) return null;

  const columns: TableColumn<PendingInvite>[] = [
    { key: 'email', label: 'Email', render: (i) => i.email, sortValue: (i) => i.email },
    { key: 'role', label: 'Role', render: (i) => roleLabel(i.role), sortValue: (i) => i.role, exportValue: (i) => roleLabel(i.role) },
    { key: 'invitedBy', label: 'Invited By', render: (i) => i.invitedBy ?? '—', sortValue: (i) => i.invitedBy ?? '' },
    {
      key: 'expiresAt',
      label: 'Link Works Until',
      render: (i) => (i.expired ? <span className="text-small font-semibold text-red-600">Expired</span> : when(i.expiresAt)),
      sortValue: (i) => i.expiresAt,
      exportValue: (i) => (i.expired ? 'Expired' : when(i.expiresAt)),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (i) =>
        i.link ? (
          <div className="flex flex-wrap gap-2">
            {i.expired ? null : <CopyButton value={i.link} label="Copy Link" />}
            <Button
              size="sm"
              variant="outline"
              disabled={resend.isPending}
              onClick={() => {
                setMessage(null);
                resend.mutate([{ email: i.email, roleId: i.roleId }], {
                  onSuccess: ([sent]) =>
                    setMessage({
                      kind: 'ok',
                      text: sent?.emailed ? `A new invitation is on its way to ${i.email}.` : `New link made for ${i.email} — copy it from the list. The old one no longer works.`,
                    }),
                  onError: (err) => setMessage({ kind: 'error', text: errorText(err) }),
                });
              }}
            >
              Send Again
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={cancel.isPending}
              onClick={() => {
                setMessage(null);
                cancel.mutate(i.id, {
                  onSuccess: () => setMessage({ kind: 'ok', text: `Invitation for ${i.email} withdrawn — its link no longer works.` }),
                  onError: (err) => setMessage({ kind: 'error', text: errorText(err) }),
                });
              }}
            >
              Withdraw
            </Button>
          </div>
        ) : (
          <span className="text-small text-surface-muted">Sent by the owner</span>
        ),
    },
  ];

  return (
    <Section label="Pending Invitations">
      <Card tone="secondary" className="flex flex-col gap-2">
        <Table columns={columns} rows={invites} emptyMessage="No invitations waiting." exportFileName="pending-invitations" />
        {message ? (
          <p id="invite-message" className={`text-small ${message.kind === 'error' ? 'text-red-600' : 'text-green-700'}`}>
            {message.text}
          </p>
        ) : null}
      </Card>
    </Section>
  );
}

const sameSet = (a: Set<string>, b: string[]) => a.size === b.length && b.every((key) => a.has(key));

/**
 * One role's pages, grouped as the sidebar groups them. Keyed by role, so
 * switching role starts from that role's saved pages.
 */
function RolePagesEditor({
  role,
  matrix,
  branchName,
  branchId,
  auth,
}: {
  role: RolePageAccess;
  matrix: PageAccessMatrix;
  branchName: string;
  branchId: string;
  auth: AuthOpts;
}) {
  const setPages = useSetRolePagesMutation(branchId, auth);
  const reset = useResetRolePagesMutation(branchId, auth);
  const [chosen, setChosen] = useState(() => new Set(role.pages));
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const available = useMemo(() => matrix.pages.filter((page) => role.available.includes(page.key)), [matrix.pages, role.available]);
  const groups = useMemo(() => {
    const byGroup = new Map<string, Map<string, typeof available>>();
    for (const page of available) {
      const features = byGroup.get(page.group) ?? new Map<string, typeof available>();
      features.set(page.feature, [...(features.get(page.feature) ?? []), page]);
      byGroup.set(page.group, features);
    }
    return [...byGroup.entries()];
  }, [available]);
  const dirty = !sameSet(chosen, role.pages);
  const label = roleLabel(role.name);

  function toggle(keys: string[], on: boolean) {
    setMessage(null);
    setChosen((current) => {
      const next = new Set(current);
      for (const key of keys) {
        if (on) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  }

  function save() {
    setMessage(null);
    setPages.mutate(
      { roleId: role.roleId, pages: [...chosen] },
      {
        onSuccess: () => setMessage({ kind: 'ok', text: `Saved. Anyone working as ${label} here sees just these pages within a minute.` }),
        onError: (err) => setMessage({ kind: 'error', text: errorText(err) }),
      },
    );
  }

  function backToDefault() {
    setMessage(null);
    reset.mutate(role.roleId, {
      onSuccess: (line) => {
        setChosen(new Set(line.pages));
        setMessage({ kind: 'ok', text: `${label} is back to every page its role can open.` });
      },
      onError: (err) => setMessage({ kind: 'error', text: errorText(err) }),
    });
  }

  return (
    <Card tone="secondary" className="flex flex-col gap-4" id="role-pages">
      <div className="flex flex-col gap-1">
        <p className="text-body font-bold text-surface">
          {label} at {branchName}
        </p>
        <p className="text-small text-surface">
          {role.customised
            ? `Set by a manager — opens ${role.pages.length} of the ${available.length} pages its role can.`
            : `Opens every page its role can (${available.length}) — nobody has changed it here.`}
        </p>
      </div>

      {available.length === 0 ? (
        <p className="text-small text-surface">
          This role can’t open any page yet. {role.isSystem ? '' : 'Give it something to read on Security & Roles first.'}
        </p>
      ) : (
        groups.map(([group, features]) => (
          <div key={group} className="flex flex-col gap-3">
            <p className="text-tiny font-semibold uppercase tracking-wide text-surface-muted">{group}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 items-start gap-4">
              {[...features.entries()].map(([feature, pages]) => {
                const keys = pages.map((page) => page.key);
                const all = keys.every((key) => chosen.has(key));
                return (
                  <fieldset key={feature} className="flex flex-col gap-1.5 rounded-card border border-secondary/15 p-3">
                    <legend className="px-1 text-small font-semibold text-surface">{feature}</legend>
                    {pages.length > 1 ? (
                      <label className="flex items-center gap-2 cursor-pointer text-tiny text-surface-muted">
                        <input
                          type="checkbox"
                          className="size-4 accent-primary cursor-pointer"
                          checked={all}
                          onChange={() => toggle(keys, !all)}
                          aria-label={`Every ${feature} page`}
                        />
                        All of {feature}
                      </label>
                    ) : null}
                    {pages.map((page) => (
                      <label key={page.key} className="flex items-center gap-2 cursor-pointer py-0.5">
                        <input
                          type="checkbox"
                          className="size-4 accent-primary cursor-pointer shrink-0"
                          checked={chosen.has(page.key)}
                          onChange={(e) => toggle([page.key], e.target.checked)}
                        />
                        <span className="text-small text-surface">{page.label}</span>
                        {role.viewOnly.includes(page.key) ? (
                          <span className="text-tiny text-surface-muted" title={`${label} can look at this page but its role can’t do what the page does`}>
                            · view only
                          </span>
                        ) : null}
                      </label>
                    ))}
                  </fieldset>
                );
              })}
            </div>
          </div>
        ))
      )}

      {chosen.size === 0 && available.length > 0 ? (
        <p className="text-small font-semibold text-surface">With no pages ticked, someone working as {label} sees nothing at this branch.</p>
      ) : null}
      {message ? (
        <p id="page-access-message" className={`text-small ${message.kind === 'error' ? 'text-red-600' : 'text-green-700'}`}>
          {message.text}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={save} loading={setPages.isPending} disabled={!dirty}>
          Save Pages
        </Button>
        {dirty ? (
          <Button type="button" variant="outline" onClick={() => setChosen(new Set(role.pages))}>
            Undo Changes
          </Button>
        ) : null}
        {role.customised ? (
          <Button type="button" variant="outline" onClick={backToDefault} loading={reset.isPending}>
            Reset to Default
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

/**
 * Page Access: which pages each staff role opens at this branch. Owners and
 * managers always see every page; everyone else sees what their manager
 * ticks here — and the server holds them to it, refusing a role the areas
 * none of its pages use.
 */
function PageAccessSection({ branchId, branchName, auth }: { branchId: string; branchName: string; auth: AuthOpts }) {
  const matrixQuery = usePageAccessQuery(branchId, auth);
  const [roleId, setRoleId] = useState<string | null>(null);
  const matrix = matrixQuery.data;
  const roles = matrix?.roles ?? [];
  const selected = roles.find((role) => role.roleId === roleId) ?? roles[0];

  return (
    <Section label="Page Access">
      <div className="flex flex-col gap-4">
        <p className="text-small text-surface max-w-3xl">
          Choose which pages each staff role opens at {branchName}. A page you take away disappears from their menu and won’t open, and Roomick also stops
          giving that role the information behind it — unless another of its pages needs it. Owners and managers always see every page.
        </p>
        {matrixQuery.isError ? <p className="text-small text-red-600">{errorText(matrixQuery.error)}</p> : null}
        {matrix && selected ? (
          <>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Role">
              {roles.map((role) => {
                const active = role.roleId === selected.roleId;
                return (
                  <button
                    key={role.roleId}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setRoleId(role.roleId)}
                    className={`rounded-control border px-3 py-2 text-small font-semibold cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      active ? 'bg-primary text-white border-primary' : 'border-primary/40 text-surface hover:bg-primary-light/40'
                    }`}
                  >
                    {roleLabel(role.name)}{' '}
                    <span className={`text-tiny font-normal ${active ? 'text-white' : 'text-surface-muted'}`}>{role.customised ? '· set here' : '· default'}</span>
                  </button>
                );
              })}
            </div>
            <RolePagesEditor key={selected.roleId} role={selected} matrix={matrix} branchName={branchName} branchId={branchId} auth={auth} />
            <p className="text-tiny text-surface-muted max-w-3xl" id="manager-only-pages">
              Only owners and managers can use {matrix.managerOnly.join(', ')} — so they aren’t offered here. To change what a role can do on its pages, use Security &amp;
              Roles.
            </p>
          </>
        ) : null}
      </div>
    </Section>
  );
}

/**
 * Staff Management (Manager Dashboard): the branch's staff, and which pages
 * each staff role opens here. Owners and managers only.
 */
export default function StaffManagementPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };
  const branchesQuery = useMyBranches(user, auth);
  const branchName = branchesQuery.data?.find((branch) => branch.id === activeBranchId)?.name ?? 'this branch';

  if (!activeBranchId) return null;

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <BackButton fallbackHref="/dashboard/manager" />
      <PageHeader title="Staff Management" subtitle="Who works at this branch, and which pages each staff role opens." roles="Owner · Manager" />
      <StaffSection branchId={activeBranchId} auth={auth} />
      <PendingInvitesSection branchId={activeBranchId} auth={auth} />
      <PageAccessSection branchId={activeBranchId} branchName={branchName} auth={auth} />
    </Container>
  );
}
