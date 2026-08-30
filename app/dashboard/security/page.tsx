'use client';

import { useMemo, useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Table, type TableColumn } from '@/components/ui/Table';
import { PageHeader } from '@/components/ui/PageHeader';
import { SecurityIcon } from '@/components/ui/Icons';
import { useRolesQuery, useUpdateRolePermissionsMutation, type Role } from '@/lib/staff';
import { useAuditLogsQuery, type AuditLogRow } from '@/lib/auditLogs';
import { useGdprRequestsQuery, useCreateGdprRequestMutation, useUpdateGdprStatusMutation, downloadGdprExport, type GdprRequestRow, type GdprType } from '@/lib/gdpr';
import { useGuestSearchQuery, type GuestSummary } from '@/lib/guests';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

/**
 * A fixed, curated module × action list — there's no canonical list stored
 * anywhere backend-side (`Role.permissions` is a free-form `{module:
 * [actions]}` JSONB map, per roomick-pms-backend's own P1 decision), so
 * this names the app's actual real domains rather than inventing a bigger
 * abstract list. `RolesGuard` still enforces purely on role NAME today —
 * this matrix is real, persisted, audited data, but not yet load-bearing.
 */
const PERMISSION_MODULES = ['reservations', 'folios', 'housekeeping', 'property', 'guests', 'reports', 'staff', 'taxes', 'alerts'] as const;
const PERMISSION_ACTIONS = ['read', 'create', 'update', 'delete'] as const;

function PermissionMatrixSection({ auth }: { auth: AuthOpts }) {
  const rolesQuery = useRolesQuery(auth);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const updateMutation = useUpdateRolePermissionsMutation(auth);

  const roleOptions: SelectOption[] = (rolesQuery.data ?? []).map((r) => ({ value: r.id, label: r.name }));
  const selectedRole: Role | undefined = (rolesQuery.data ?? []).find((r) => r.id === selectedRoleId);
  const permissions = selectedRole?.permissions ?? {};

  function hasAction(module: string, action: string): boolean {
    return (permissions[module] ?? []).includes(action);
  }

  function toggle(module: string, action: string) {
    if (!selectedRole) return;
    setSaved(false);
    const current = new Set(permissions[module] ?? []);
    if (current.has(action)) current.delete(action);
    else current.add(action);
    const next = { ...permissions, [module]: [...current] };
    updateMutation.mutate({ roleId: selectedRole.id, permissions: next }, { onSuccess: () => setSaved(true) });
  }

  return (
    <Section label="Role & Permission Matrix">
      <div className="flex flex-col gap-3">
        <p className="text-tiny text-secondary-light">
          Stored and audited per role, but not yet enforced — routes are still gated by role name (Owner/Manager/Front Desk/etc.), not this map. Use it to document intended
          access ahead of enforcement landing.
        </p>
        <div className="max-w-xs">
          <Select id="permission-matrix-role" label="Role" options={roleOptions} value={selectedRoleId} onChange={(v) => { setSelectedRoleId(v); setSaved(false); }} placeholder="Select a role to edit" />
        </div>
        {selectedRole ? (
          <Card tone="secondary" className="overflow-x-auto">
            <table className="w-full text-small">
              <thead>
                <tr>
                  <th className="text-left py-1.5 pr-4 font-semibold text-secondary">Module</th>
                  {PERMISSION_ACTIONS.map((action) => (
                    <th key={action} className="text-center py-1.5 px-3 font-semibold text-secondary capitalize">
                      {action}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_MODULES.map((module) => (
                  <tr key={module} className="border-t border-secondary-light/20">
                    <td className="py-1.5 pr-4 capitalize">{module}</td>
                    {PERMISSION_ACTIONS.map((action) => (
                      <td key={action} className="text-center py-1.5 px-3">
                        <input
                          type="checkbox"
                          aria-label={`${module} ${action}`}
                          checked={hasAction(module, action)}
                          onChange={() => toggle(module, action)}
                          disabled={updateMutation.isPending}
                          className="size-4 accent-primary cursor-pointer"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {saved ? <p className="text-small text-green-700 mt-2">Saved.</p> : null}
          </Card>
        ) : (
          <p className="text-small text-secondary-light">Select a role above to view or edit its permission map.</p>
        )}
      </div>
    </Section>
  );
}

function AuditDiff({ before, after }: { before: unknown; after: unknown }) {
  const [open, setOpen] = useState(false);
  if (before === null && after === null) return <span className="text-secondary-light">—</span>;
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
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const limit = 25;

  const query = useAuditLogsQuery({ action: action || undefined, from: from || undefined, to: to || undefined, page, limit }, auth);

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
          <Input id="audit-log-from" label="From" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          <Input id="audit-log-to" label="To" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </div>

        {query.isLoading ? (
          <p className="text-body text-primary-dark/70">Loading audit log…</p>
        ) : (
          <>
            <Card tone="secondary">
              <Table columns={columns} rows={query.data?.rows ?? []} emptyMessage="No audit log entries match these filters." exportFileName="audit-logs" />
            </Card>
            <div className="flex items-center justify-between text-small text-secondary-light">
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
        if (r.status === 'completed' || r.status === 'rejected') return new Date(r.deadline).toLocaleDateString();
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
              <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ requestId: r.id, status: 'completed' })}>
                Mark Completed
              </Button>
              <Button size="sm" variant="danger" onClick={() => statusMutation.mutate({ requestId: r.id, status: 'rejected' })}>
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
          <p className="text-small font-semibold text-primary-dark">File a new request</p>
          {!selectedGuest ? (
            <>
              <Input id="gdpr-guest-search" label="Find a guest" placeholder="Guest name or email" value={guestSearch} onChange={(e) => setGuestSearch(e.target.value)} />
              {guestSearch.trim() && (
                <Card tone="secondary" className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                  {(guestSearchQuery.data ?? []).length === 0 ? (
                    <p className="text-small text-secondary-light">No matching guests.</p>
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
                <p className="font-semibold text-primary-dark">{selectedGuest.name}</p>
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
          <p className="text-body text-primary-dark/70">Loading requests…</p>
        ) : (
          <Card tone="secondary">
            <Table columns={columns} rows={requestsQuery.data ?? []} emptyMessage="No GDPR requests filed yet." exportFileName="gdpr-requests" />
          </Card>
        )}
        <p className="text-tiny text-secondary-light">
          Erasure requests are tracked here but not automated — this system does not delete data across reservations/folios/audit history on its own. Mark one completed once the
          erasure has actually been carried out through your own process.
        </p>
      </div>
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
      <AuditLogSection auth={auth} />
      <GdprSection auth={auth} />
    </Container>
  );
}
