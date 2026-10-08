'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Table, type TableColumn } from '@/components/ui/Table';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { PageHeader } from '@/components/ui/PageHeader';
import { SecurityIcon } from '@/components/ui/Icons';
import {
  useCreateRoleMutation,
  useDeleteRoleMutation,
  usePermissionCatalogueQuery,
  useRolesQuery,
  useUpdateRoleMutation,
  useUpdateRolePermissionsMutation,
  type Role,
} from '@/lib/staff';
import { useAuditLogsQuery, type AuditLogRow } from '@/lib/auditLogs';
import {
  useGdprRequestsQuery,
  useCreateGdprRequestMutation,
  useUpdateGdprStatusMutation,
  useEraseGuestMutation,
  useRetentionQuery,
  useRunRetentionMutation,
  useSetRetentionMutation,
  downloadGdprExport,
  type GdprRequestRow,
  type GdprType,
} from '@/lib/gdpr';
import { useGuestSearchQuery, type GuestSummary } from '@/lib/guests';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';
import { formatDateOnly } from '@/lib/dates';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

function RoleLabel({ name, isSystem }: { name: string; isSystem: boolean }) {
  return (
    <span>
      {name}
      {isSystem ? <span className="text-tiny text-surface-muted"> · built-in</span> : null}
    </span>
  );
}

/**
 * Roles and what each one may do. The six built-in roles are shown as they
 * really are — read off the routes by the API, not editable, because their
 * access is what the code says it is. A custom role is the opposite: it holds
 * no name the routes know, so this matrix is the whole of its access, and the
 * guard enforces exactly what's ticked here.
 */
function PermissionMatrixSection({ auth }: { auth: AuthOpts }) {
  const rolesQuery = useRolesQuery(auth);
  const catalogueQuery = usePermissionCatalogueQuery(auth);
  const updatePermissions = useUpdateRolePermissionsMutation(auth);
  const updateRole = useUpdateRoleMutation(auth);
  const deleteRole = useDeleteRoleMutation(auth);

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const roles = rolesQuery.data ?? [];
  const catalogue = catalogueQuery.data;
  const roleOptions: SelectOption[] = roles.map((r) => ({ value: r.id, label: r.isSystem ? `${r.name} (built-in)` : r.name }));
  const selectedRole: Role | undefined = roles.find((r) => r.id === selectedRoleId);
  const modules = catalogue?.modules ?? [];
  const actions = catalogue?.actions ?? [];

  // A built-in role's map is derived from the routes; a custom role's is its own.
  const effective: Record<string, string[]> = selectedRole
    ? selectedRole.isSystem
      ? (catalogue?.systemRolePresets[selectedRole.name] ?? {})
      : (selectedRole.permissions ?? {})
    : {};
  const editable = selectedRole !== undefined && !selectedRole.isSystem;

  function toggle(moduleKey: string, action: string) {
    if (!selectedRole || !editable) return;
    setMessage(null);
    const current = new Set(effective[moduleKey] ?? []);
    if (current.has(action)) current.delete(action);
    else current.add(action);
    const next = { ...effective, [moduleKey]: [...current] };
    updatePermissions.mutate(
      { roleId: selectedRole.id, permissions: next },
      {
        onSuccess: () => setMessage({ kind: 'ok', text: 'Saved. It applies to everyone holding this role straight away.' }),
        onError: (err) => setMessage({ kind: 'error', text: err instanceof ApiError ? err.message : 'Couldn’t save that.' }),
      },
    );
  }

  function remove() {
    if (!selectedRole) return;
    setMessage(null);
    deleteRole.mutate(selectedRole.id, {
      onSuccess: () => {
        setSelectedRoleId(null);
        setMessage({ kind: 'ok', text: `“${selectedRole.name}” deleted.` });
      },
      onError: (err) => setMessage({ kind: 'error', text: err instanceof ApiError ? err.message : 'Couldn’t delete that role.' }),
    });
  }

  return (
    <Section label="Roles & Permissions">
      <div className="flex flex-col gap-3">
        <p className="text-small text-surface">
          The six built-in roles cover the usual jobs. Create a custom role for anything else — a night auditor, a revenue manager — and tick exactly what it
          may do. Staff are given a role per property, and each property’s manager chooses the pages a role opens there, under Manager Dashboard → Staff Management.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-64">
            <Select
              id="permission-matrix-role"
              label="Role"
              options={roleOptions}
              value={selectedRoleId}
              onChange={(v) => {
                setSelectedRoleId(v);
                setMessage(null);
              }}
              placeholder="Choose a role"
            />
          </div>
          <Button type="button" variant="outline" className="mb-2" onClick={() => setCreating(true)}>
            New Custom Role
          </Button>
          {editable && selectedRole ? (
            <>
              <Button type="button" size="sm" variant="outline" className="mb-2" onClick={() => setRenaming(selectedRole.name)}>
                Rename
              </Button>
              <Button type="button" size="sm" variant="outline" className="mb-2" onClick={remove} loading={deleteRole.isPending}>
                Delete
              </Button>
            </>
          ) : null}
        </div>

        {selectedRole ? (
          <Card tone="secondary" className="overflow-x-auto">
            <p className="text-small text-surface pb-2">
              <span className="font-semibold">
                <RoleLabel name={selectedRole.name} isSystem={selectedRole.isSystem} />
              </span>{' '}
              {selectedRole.isSystem
                ? '— what this role can do is fixed by the app. This is what it covers today; create a custom role to tailor access.'
                : '— everything this role can do is ticked below. Nothing else is open to it.'}
            </p>
            <table className="w-full min-w-[34rem] text-small" id="permission-matrix">
              <thead>
                <tr>
                  <th className="text-left py-1.5 pr-4 font-semibold text-surface">Area</th>
                  {actions.map((action) => (
                    <th key={action} className="text-center py-1.5 px-3 font-semibold text-surface capitalize">
                      {action}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modules.map((module) => (
                  <tr key={module.key} className="border-t border-secondary-light/20">
                    <td className="py-1.5 pr-4">
                      <span title={module.description}>{module.label}</span>
                    </td>
                    {actions.map((action) => (
                      <td key={action} className="text-center py-1.5 px-3">
                        <input
                          type="checkbox"
                          aria-label={`${module.label} ${action}`}
                          checked={(effective[module.key] ?? []).includes(action)}
                          onChange={() => toggle(module.key, action)}
                          disabled={!editable || updatePermissions.isPending}
                          className="size-4 accent-primary disabled:opacity-60 cursor-pointer disabled:cursor-default"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {message ? (
              <p id="role-message" className={`text-small mt-2 ${message.kind === 'error' ? 'text-red-600' : 'text-green-700'}`}>
                {message.text}
              </p>
            ) : null}
          </Card>
        ) : (
          <p className="text-small text-surface-muted">Choose a role to see what it can do.</p>
        )}

        {catalogue ? (
          <p className="text-tiny text-surface-muted" id="undelegatable">
            No custom role can be given: {catalogue.undelegatable.join(', ').toLowerCase()}. Those stay with the owner and manager roles, so a role can never
            widen its own access.
          </p>
        ) : null}
        {message && !selectedRole ? (
          <p id="role-message" className={`text-small ${message.kind === 'error' ? 'text-red-600' : 'text-green-700'}`}>
            {message.text}
          </p>
        ) : null}
      </div>

      {creating && catalogue ? (
        <NewRoleModal
          auth={auth}
          presets={catalogue.systemRolePresets}
          onClose={() => setCreating(false)}
          onCreated={(role) => {
            setCreating(false);
            setSelectedRoleId(role.id);
            setMessage({ kind: 'ok', text: `“${role.name}” created. Tick what it may do below.` });
          }}
        />
      ) : null}

      {renaming !== null && selectedRole ? (
        <RenameRoleModal
          initialName={renaming}
          saving={updateRole.isPending}
          onClose={() => setRenaming(null)}
          onSave={(name) =>
            updateRole.mutate(
              { roleId: selectedRole.id, name },
              {
                onSuccess: () => {
                  setRenaming(null);
                  setMessage({ kind: 'ok', text: 'Renamed.' });
                },
                onError: (err) => setMessage({ kind: 'error', text: err instanceof ApiError ? err.message : 'Couldn’t rename it.' }),
              },
            )
          }
        />
      ) : null}
    </Section>
  );
}

function NewRoleModal({
  auth,
  presets,
  onClose,
  onCreated,
}: {
  auth: AuthOpts;
  presets: Record<string, Record<string, string[]>>;
  onClose: () => void;
  onCreated: (role: Role) => void;
}) {
  const createRole = useCreateRoleMutation(auth);
  const [name, setName] = useState('');
  const [startFrom, setStartFrom] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const presetOptions: SelectOption[] = [
    { value: '', label: 'Nothing — start empty' },
    ...Object.keys(presets).map((role) => ({ value: role, label: `What ${role.replace(/_/g, ' ')} can do` })),
  ];

  function save() {
    setError(null);
    createRole.mutate(
      { name: name.trim(), permissions: startFrom ? presets[startFrom] : {} },
      { onSuccess: onCreated, onError: (err) => setError(err instanceof ApiError ? err.message : 'Couldn’t create the role.') },
    );
  }

  return (
    <Modal open onClose={onClose} title="New Custom Role">
      <div className="flex flex-col gap-3">
        <Input id="new-role-name" label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Night Auditor" />
        <Select
          id="new-role-preset"
          label="Start from"
          options={presetOptions}
          value={startFrom ?? ''}
          onChange={(v) => setStartFrom(v || null)}
          hint="A starting point you can then adjust — it doesn’t link the roles together."
        />
        {error ? <p className="text-small text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={save} loading={createRole.isPending} disabled={name.trim().length < 2}>
            Create Role
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function RenameRoleModal({
  initialName,
  saving,
  onClose,
  onSave,
}: {
  initialName: string;
  saving: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);
  return (
    <Modal open onClose={onClose} title="Rename Role">
      <div className="flex flex-col gap-3">
        <Input id="rename-role-name" label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={() => onSave(name.trim())} loading={saving} disabled={name.trim().length < 2 || name.trim() === initialName}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Two-step sign-in is per person, so it's set up under My Account; this says where, and how an owner helps someone locked out. */
function TwoStepSignInSection() {
  return (
    <Section label="Two-Step Sign-In">
      <Card tone="secondary" className="flex flex-col gap-2">
        <p className="text-small text-surface">
          Anyone can add a code from an authenticator app to their sign-in: click your name at the top right, then My Account. Owners and managers especially
          should — their accounts can see guest data and change who has access.
        </p>
        <p className="text-small text-surface">
          Someone who has lost their phone signs in with one of their recovery codes. If those are gone too, an owner can reset their two-step sign-in from
          Manager Dashboard → Staff Management.
        </p>
        <div>
          <Link href="/dashboard/account" className="text-small font-semibold text-surface underline underline-offset-2">
            Set up mine →
          </Link>
        </div>
      </Card>
    </Section>
  );
}

function AuditDiff({ before, after }: { before: unknown; after: unknown }) {
  const [open, setOpen] = useState(false);
  if (before === null && after === null) return <span className="text-surface-muted">—</span>;
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} className="text-tiny text-accent-dark underline cursor-pointer">
        {open ? 'Hide' : 'View'} diff
      </button>
      {open ? (
        <div className="mt-1 flex flex-col gap-1 max-w-md">
          {before !== null ? <pre className="text-tiny bg-red-50 text-red-900 rounded p-1.5 overflow-x-auto">{JSON.stringify(before, null, 1)}</pre> : null}
          {after !== null ? <pre className="text-tiny bg-green-50 text-green-900 rounded p-1.5 overflow-x-auto">{JSON.stringify(after, null, 1)}</pre> : null}
        </div>
      ) : null}
    </div>
  );
}

function AuditLogSection({ auth }: { auth: AuthOpts }) {
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [entityId, setEntityId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const limit = 25;

  const query = useAuditLogsQuery({ action: action || undefined, entityType: entityType.trim() || undefined, entityId: entityId.trim() || undefined, from: from || undefined, to: to || undefined, page, limit }, auth);

  const columns: TableColumn<AuditLogRow>[] = [
    { key: 'timestamp', label: 'Timestamp', render: (r) => new Date(r.timestamp).toLocaleString(), sortValue: (r) => r.timestamp },
    { key: 'user', label: 'User', render: (r) => r.user?.name ?? 'System', sortValue: (r) => r.user?.name ?? '' },
    { key: 'action', label: 'Action', render: (r) => r.action, sortValue: (r) => r.action },
    {
      key: 'entity',
      label: 'Entity',
      render: (r) => (r.entityType ? `${r.entityType}${r.entityId ? ` (${r.entityId.slice(0, 8)}…)` : ''}` : '—'),
      exportValue: (r) => (r.entityType ? `${r.entityType}:${r.entityId ?? ''}` : ''),
    },
    { key: 'ip', label: 'IP Address', render: (r) => r.ipAddress ?? '—', exportValue: (r) => r.ipAddress ?? '' },
    { key: 'diff', label: 'Before / After', render: (r) => <AuditDiff before={r.before} after={r.after} /> },
  ];

  const totalPages = query.data ? Math.max(1, Math.ceil(query.data.total / limit)) : 1;

  return (
    <Section label="Audit Log Viewer">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-4">
          <Input id="audit-log-action" label="Action contains" placeholder="e.g. reservation.check_in" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} />
          <Input id="audit-log-entity-type" label="Record type" placeholder="e.g. reservation, folio, guest_profile" value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }} />
          <Input id="audit-log-entity-id" label="Record id" placeholder="One record’s whole history" value={entityId} onChange={(e) => { setEntityId(e.target.value); setPage(1); }} />
          <Input id="audit-log-from" label="From" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          <Input id="audit-log-to" label="To" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </div>

        {query.isLoading ? (
          <p className="text-body text-surface-muted">Loading audit log…</p>
        ) : (
          <>
            <Card tone="secondary">
              <Table columns={columns} rows={query.data?.rows ?? []} emptyMessage="No audit log entries match these filters." exportFileName="audit-logs" />
            </Card>
            <div className="flex items-center justify-between text-small text-surface-muted">
              <span>
                Page {page} of {totalPages} — {query.data?.total ?? 0} total entries
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                  Previous
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Section>
  );
}

function daysUntil(deadline: string): number {
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000);
}

function GdprSection({ auth }: { auth: AuthOpts }) {
  const [guestSearch, setGuestSearch] = useState('');
  const [selectedGuest, setSelectedGuest] = useState<GuestSummary | null>(null);
  const [type, setType] = useState<GdprType>('access');
  const [requestedBy, setRequestedBy] = useState('');
  const [verificationMethod, setVerificationMethod] = useState('');
  const [error, setError] = useState<string | null>(null);

  const guestSearchQuery = useGuestSearchQuery(guestSearch, auth);
  const requestsQuery = useGdprRequestsQuery(auth);
  const createMutation = useCreateGdprRequestMutation(auth);
  const statusMutation = useUpdateGdprStatusMutation(auth);
  const eraseMutation = useEraseGuestMutation(auth);
  const [erasing, setErasing] = useState<GdprRequestRow | null>(null);
  const [rejecting, setRejecting] = useState<GdprRequestRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [eraseError, setEraseError] = useState<string | null>(null);

  const typeOptions: SelectOption[] = [
    { value: 'access', label: 'Access' },
    { value: 'erasure', label: 'Erasure' },
    { value: 'portability', label: 'Portability' },
  ];

  async function handleSubmit() {
    if (!selectedGuest || !requestedBy) return;
    setError(null);
    try {
      await createMutation.mutateAsync({ guestId: selectedGuest.id, type, requestedBy, verificationMethod: verificationMethod || undefined });
      setSelectedGuest(null);
      setRequestedBy('');
      setVerificationMethod('');
      setType('access');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  const columns: TableColumn<GdprRequestRow>[] = [
    { key: 'guest', label: 'Guest', render: (r) => r.guest.name, sortValue: (r) => r.guest.name },
    { key: 'type', label: 'Type', render: (r) => <span className="capitalize">{r.type}</span>, sortValue: (r) => r.type },
    {
      key: 'status',
      label: 'Status',
      render: (r) => (
        <span
          className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-tiny font-semibold capitalize ${
            r.status === 'completed' ? 'bg-green-100 text-green-800' : r.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-secondary-light/20 text-secondary'
          }`}
        >
          {r.status.replace('_', ' ')}
        </span>
      ),
      sortValue: (r) => r.status,
    },
    {
      key: 'deadline',
      label: 'Deadline',
      render: (r) => {
        if (r.status === 'completed' || r.status === 'rejected') return formatDateOnly(r.deadline);
        const days = daysUntil(r.deadline);
        return <span className={days < 0 ? 'font-semibold text-red-600' : days <= 7 ? 'font-semibold text-primary' : ''}>{days < 0 ? `${-days}d overdue` : `${days}d left`}</span>;
      },
      sortValue: (r) => r.deadline,
    },
    {
      key: 'action',
      label: 'Action',
      align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-2">
          {r.type !== 'erasure' ? (
            <Button size="sm" variant="outline" onClick={() => downloadGdprExport(r.id, auth)}>
              Download Export
            </Button>
          ) : null}
          {r.status !== 'completed' && r.status !== 'rejected' ? (
            <>
              {r.status === 'pending' ? (
                <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ requestId: r.id, status: 'in_progress' })}>
                  Mark In Progress
                </Button>
              ) : null}
              {r.type === 'erasure' ? (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    setEraseError(null);
                    setErasing(r);
                  }}
                >
                  Erase Guest Data
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ requestId: r.id, status: 'completed' })}>
                  Mark Completed
                </Button>
              )}
              <Button size="sm" variant="danger" onClick={() => setRejecting(r)}>
                Reject
              </Button>
            </>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <Section label="GDPR Compliance">
      <div className="flex flex-col gap-4">
        <Card tone="accent" className="flex flex-col gap-3">
          <p className="text-small font-semibold text-surface">File a new request</p>
          {!selectedGuest ? (
            <>
              <Input id="gdpr-guest-search" label="Find a guest" placeholder="Guest name or email" value={guestSearch} onChange={(e) => setGuestSearch(e.target.value)} />
              {guestSearch.trim() && (
                <Card tone="secondary" className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                  {(guestSearchQuery.data ?? []).length === 0 ? (
                    <p className="text-small text-surface-muted">No matching guests.</p>
                  ) : (
                    (guestSearchQuery.data ?? []).map((g) => (
                      <button key={g.id} type="button" onClick={() => { setSelectedGuest(g); setGuestSearch(''); }} className="text-left rounded-control px-2 py-1 hover:bg-secondary-light/20">
                        {g.name} {g.email ? `— ${g.email}` : ''}
                      </button>
                    ))
                  )}
                </Card>
              )}
            </>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-surface">{selectedGuest.name}</p>
                <Button size="sm" variant="outline" onClick={() => setSelectedGuest(null)}>
                  Change guest
                </Button>
              </div>
              <Select id="gdpr-request-type" label="Request type" options={typeOptions} value={type} onChange={(v) => setType(v as GdprType)} />
              <Input id="gdpr-requested-by" label="Requested by" placeholder="email address" value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} error={error ?? undefined} />
              <Input id="gdpr-verification" label="Verification method (optional)" value={verificationMethod} onChange={(e) => setVerificationMethod(e.target.value)} />
              <div>
                <Button type="button" onClick={handleSubmit} disabled={createMutation.isPending || !requestedBy}>
                  {createMutation.isPending ? 'Filing…' : 'File Request'}
                </Button>
              </div>
            </div>
          )}
        </Card>

        {requestsQuery.isLoading ? (
          <p className="text-body text-surface-muted">Loading requests…</p>
        ) : (
          <Card tone="secondary">
            <Table columns={columns} rows={requestsQuery.data ?? []} emptyMessage="No GDPR requests filed yet." exportFileName="gdpr-requests" />
          </Card>
        )}
        {eraseError ? <p className="text-small text-red-600">{eraseError}</p> : null}
        <p className="text-tiny text-surface-muted">
          <span className="font-semibold">Erase Guest Data</span> carries out an erasure request: the guest&apos;s name, contact details, ID document and photo,
          registration-card details and signature, notes, preferences and the text of their messages are erased for good. Their stays, bills and payments stay — the
          financial record you&apos;re required to keep — under &ldquo;Erased guest&rdquo;. It waits while they have a stay booked or still owe money.
        </p>
      </div>
      <ConfirmDialog
        open={erasing !== null}
        title={erasing ? `Erase ${erasing.guest.name}?` : ''}
        description="This can't be undone. Their name, contact details, ID document and photo, registration-card details, notes and message text are erased now. Stays, bills and payments are kept, under “Erased guest”."
        confirmLabel="Erase"
        loading={eraseMutation.isPending}
        onCancel={() => setErasing(null)}
        onConfirm={() => {
          if (!erasing) return;
          eraseMutation.mutate(erasing.id, {
            onError: (err) => setEraseError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.'),
            onSettled: () => setErasing(null),
          });
        }}
      />
      {rejecting ? (
        <Modal open onClose={() => setRejecting(null)} title={`Reject ${rejecting.guest.name}’s request?`}>
          <p className="text-small text-surface-muted">A rejection is final for this request, and the guest can ask why — the reason is kept with it.</p>
          <Textarea id="gdpr-reject-reason" label="Reason" rows={3} maxLength={500} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => setRejecting(null)}>
              Keep it
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={rejectReason.trim().length < 3}
              loading={statusMutation.isPending}
              onClick={() => {
                const target = rejecting;
                setRejecting(null);
                statusMutation.mutate({ requestId: target.id, status: 'rejected', notes: rejectReason.trim() });
                setRejectReason('');
              }}
            >
              Reject
            </Button>
          </div>
        </Modal>
      ) : null}
    </Section>
  );
}

const RETENTION_PRESETS: Array<{ months: number; label: string }> = [
  { months: 6, label: '6 months' },
  { months: 12, label: '1 year' },
  { months: 24, label: '2 years' },
  { months: 36, label: '3 years' },
  { months: 60, label: '5 years' },
  { months: 84, label: '7 years' },
  { months: 120, label: '10 years' },
];
const KEEP_EVERYTHING = 'keep';

function periodLabel(months: number): string {
  return RETENTION_PRESETS.find((preset) => preset.months === months)?.label ?? `${months} months`;
}

function dueText(due: { registrationCards: number; idDocuments: number }): string {
  const cards = `${due.registrationCards} registration card${due.registrationCards === 1 ? '' : 's'}`;
  const ids = `${due.idDocuments} guest ID document${due.idDocuments === 1 ? '' : 's'}`;
  return `${cards} and ${ids}`;
}

/**
 * Document retention: how long registration cards and guests' ID documents
 * are kept after a stay. Off until the owner picks a period; then whatever is
 * older goes every night — the guest's details off the card, the ID document
 * off the guest. Stays, bills and payments are never touched.
 */
function RetentionSection({ auth }: { auth: AuthOpts }) {
  const saved = useRetentionQuery(auth);
  const setRetention = useSetRetentionMutation(auth);
  const runNow = useRunRetentionMutation(auth);
  const [choice, setChoice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const savedValue = saved.data ? (saved.data.months === null ? KEEP_EVERYTHING : String(saved.data.months)) : null;
  const chosen = choice ?? savedValue;
  const chosenMonths = chosen && chosen !== KEEP_EVERYTHING ? Number(chosen) : undefined;
  const changed = chosen !== null && chosen !== savedValue;
  const preview = useRetentionQuery(auth, changed ? chosenMonths : undefined);
  const previewDue = changed && chosenMonths !== undefined ? preview.data?.due : undefined;
  const previewCount = previewDue ? previewDue.registrationCards + previewDue.idDocuments : 0;

  const savedMonths = saved.data?.months ?? null;
  const options: SelectOption[] = [
    { value: KEEP_EVERYTHING, label: 'Keep everything' },
    ...RETENTION_PRESETS.map((preset) => ({ value: String(preset.months), label: preset.label })),
    ...(savedMonths !== null && !RETENTION_PRESETS.some((preset) => preset.months === savedMonths) ? [{ value: String(savedMonths), label: `${savedMonths} months` }] : []),
  ];

  function save() {
    setMessage(null);
    setRetention.mutate(chosenMonths ?? null, {
      onSuccess: (result) => {
        setChoice(null);
        setMessage({
          kind: 'ok',
          text:
            result.months === null
              ? 'Saved — everything is kept.'
              : `Saved — kept for ${periodLabel(result.months)} after a stay. Anything older is removed every night at 4:30.`,
        });
      },
      onError: (err) => setMessage({ kind: 'error', text: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.' }),
      onSettled: () => setConfirming(false),
    });
  }

  const dueNow = saved.data && !changed ? saved.data.due : undefined;
  const dueCount = dueNow ? dueNow.registrationCards + dueNow.idDocuments : 0;

  return (
    <Section label="Document Retention">
      <Card tone="secondary" className="flex flex-col gap-3 max-w-2xl">
        <p className="text-small text-surface">
          How long registration cards and guests’ ID documents are kept after a stay ends. Once the period has passed, the guest’s name, contact details and
          signature come off the card and its stored PDF is deleted; their ID document and photo are removed too, unless they have another stay booked. Stays,
          bills and payments are always kept.
        </p>
        <p className="text-small text-surface">Check how long the law where you operate requires you to keep guest registration records before choosing.</p>
        {saved.isError ? <p className="text-small text-red-600">{saved.error instanceof ApiError ? saved.error.message : 'Couldn’t load the setting.'}</p> : null}
        {chosen !== null ? (
          <div className="max-w-xs">
            <Select
              id="retention-period"
              label="Keep for"
              options={options}
              value={chosen}
              onChange={(value) => {
                setChoice(value);
                setMessage(null);
              }}
            />
          </div>
        ) : null}
        {previewDue ? (
          <p className="text-small font-semibold text-surface" id="retention-preview">
            {previewCount === 0 ? 'Nothing is older than that yet.' : `${dueText(previewDue)} are older than that — they’d be removed tonight.`}
          </p>
        ) : null}
        {dueNow && dueCount > 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-small text-surface" id="retention-due">
              {dueText(dueNow)} are past the period and go tonight.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              loading={runNow.isPending}
              onClick={() => {
                setMessage(null);
                runNow.mutate(undefined, {
                  onSuccess: (run) => setMessage({ kind: 'ok', text: `Removed now: ${dueText({ registrationCards: run.registrationCards, idDocuments: run.idDocuments })}.` }),
                  onError: (err) => setMessage({ kind: 'error', text: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.' }),
                });
              }}
            >
              Remove Now
            </Button>
          </div>
        ) : null}
        <p className="text-tiny text-surface-muted">Backups made before a removal still hold what was removed, for as long as backups are kept.</p>
        {message ? (
          <p id="retention-message" className={`text-small ${message.kind === 'error' ? 'text-red-600' : 'text-green-700'}`}>
            {message.text}
          </p>
        ) : null}
        <div>
          <Button
            type="button"
            disabled={!changed || setRetention.isPending || (chosenMonths !== undefined && !preview.data)}
            loading={setRetention.isPending}
            onClick={() => (previewCount > 0 ? setConfirming(true) : save())}
          >
            Save Retention
          </Button>
        </div>
      </Card>
      <ConfirmDialog
        open={confirming}
        title="Start removing old documents?"
        description={previewDue ? `${dueText(previewDue)} are older than ${chosenMonths ? periodLabel(chosenMonths) : 'that'} and will be removed tonight. This can’t be undone.` : ''}
        confirmLabel="Save and Remove"
        onCancel={() => setConfirming(false)}
        onConfirm={save}
        loading={setRetention.isPending}
      />
    </Section>
  );
}

/**
 * Security & Roles (pms-frontend-structure-2.html's own `page-security`) —
 * second of the 11 Management/Admin gaps. Turned out to need more real
 * backend work than Manager Dashboard: the Role/Permission Matrix reuses
 * P1's existing GET/PUT `/auth/roles` endpoints, but the Audit Log Viewer
 * and GDPR Compliance both needed new backend modules (see the backend's
 * own PHASE_NOTES.md). "Custom role creator" and "preset role templates"
 * are NOT built — there's no `POST /auth/roles` endpoint to create a new
 * role against, and inventing one wasn't asked for; editing an EXISTING
 * role's permissions is real and works.
 */
export default function SecurityRolesPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const auth = useMemo(() => ({ accessToken: accessToken ?? undefined, tenantId: user?.tenantId }), [accessToken, user?.tenantId]);

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader
        icon={<SecurityIcon className="size-8" />}
        title="Security & Roles"
        subtitle="RBAC, permissions matrix, audit logs, MFA, GDPR, PCI compliance."
        roles="Admin"
      />

      <PermissionMatrixSection auth={auth} />
      <TwoStepSignInSection />
      <AuditLogSection auth={auth} />
      <GdprSection auth={auth} />
      <RetentionSection auth={auth} />
    </Container>
  );
}
