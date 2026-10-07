'use client';

import { useMemo, useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Table, type TableColumn } from '@/components/ui/Table';
import { PageHeader } from '@/components/ui/PageHeader';
import { BackButton } from '@/components/ui/BackButton';
import { useRolesQuery, useStaffQuery, useBulkInviteMutation, usePatchStaffMutation, type StaffMember } from '@/lib/staff';
import { usePageAccessQuery, useResetRolePagesMutation, useSetRolePagesMutation, type PageAccessMatrix, type RolePageAccess } from '@/lib/pageAccess';
import { useResetStaffMfaMutation } from '@/lib/mfa';
import { useMyBranches } from '@/lib/dashboardBranches';
import { roleLabel } from '@/lib/roles';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

const errorText = (err: unknown) => (err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');

function InviteStaffModal({ open, onClose, branchId, auth }: { open: boolean; onClose: () => void; branchId: string; auth: AuthOpts }) {
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rolesQuery = useRolesQuery(auth);
  const inviteMutation = useBulkInviteMutation(branchId, auth);

  const roleOptions: SelectOption[] = (rolesQuery.data ?? []).map((r) => ({ value: r.id, label: roleLabel(r.name) }));

  async function handleSubmit() {
    if (!email || !roleId) return;
    setError(null);
    try {
      await inviteMutation.mutateAsync([{ email, roleId }]);
      setEmail('');
      setRoleId(null);
      onClose();
    } catch (err) {
      setError(errorText(err));
    }
  }

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="Invite Staff">
      <Input id="invite-staff-email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error ?? undefined} />
      <Select id="invite-staff-role" label="Role" options={roleOptions} value={roleId} onChange={setRoleId} placeholder="Select a role" />
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={inviteMutation.isPending || !email || !roleId}>
          {inviteMutation.isPending ? 'Sending…' : 'Send Invite'}
        </Button>
      </div>
    </Modal>
  );
}

/** Who works at this branch: their role, last sign-in, two-step sign-in and whether they can still sign in. */
function StaffSection({ branchId, auth }: { branchId: string; auth: AuthOpts }) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const staffQuery = useStaffQuery(branchId, auth);
  const patchStaffMutation = usePatchStaffMutation(branchId, auth);
  const resetMfa = useResetStaffMfaMutation(auth);
  const me = useAuthStore((s) => s.user);
  const isOwner = me?.roles.some((r) => r.role === 'owner') ?? false;
  const [mfaMessage, setMfaMessage] = useState<string | null>(null);

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
      render: (s) => (
        <Button size="sm" variant="outline" onClick={() => patchStaffMutation.mutate({ userId: s.id, active: !s.active })} disabled={patchStaffMutation.isPending}>
          {s.active ? 'Active — Deactivate' : 'Inactive — Reactivate'}
        </Button>
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
            {mfaMessage ? (
              <p className="text-small text-surface mt-2" id="staff-mfa-message">
                {mfaMessage}
              </p>
            ) : null}
          </Card>
        )}
      </div>
      <InviteStaffModal open={inviteOpen} onClose={() => setInviteOpen(false)} branchId={branchId} auth={auth} />
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
      <PageAccessSection branchId={activeBranchId} branchName={branchName} auth={auth} />
    </Container>
  );
}
