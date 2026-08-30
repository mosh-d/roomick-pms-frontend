'use client';

import { useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select, type SelectOption } from '@/components/ui/Select';
import { YesNoToggle } from '@/components/ui/YesNoToggle';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Table, type TableColumn } from '@/components/ui/Table';
import { PageHeader } from '@/components/ui/PageHeader';
import { MaintenanceIcon } from '@/components/ui/Icons';
import {
  useWorkOrdersQuery,
  useCreateWorkOrderMutation,
  useUpdateWorkOrderMutation,
  useAssetsQuery,
  useCreateAssetMutation,
  type WorkOrder,
  type MaintenanceAsset,
  type MaintenancePriority,
  type MaintenanceStatus,
} from '@/lib/maintenance';
import { useRoomsQuery } from '@/lib/rooms';
import { useStaffQuery } from '@/lib/staff';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

const PRIORITY_OPTIONS: SelectOption[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_COLUMNS: Array<{ status: MaintenanceStatus; label: string }> = [
  { status: 'open', label: 'Open' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'on_hold', label: 'On Hold' },
  { status: 'resolved', label: 'Resolved' },
  { status: 'cancelled', label: 'Cancelled' },
];

const PRIORITY_CLASSES: Record<MaintenancePriority, string> = {
  low: 'bg-secondary-light/20 text-secondary',
  medium: 'bg-accent/20 text-accent-dark',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
};

function PriorityBadge({ priority }: { priority: MaintenancePriority }) {
  return <span className={`inline-flex items-center rounded-pill px-2 py-0.5 text-tiny font-semibold capitalize ${PRIORITY_CLASSES[priority]}`}>{priority}</span>;
}

function WorkOrderSubmissionSection({ branchId, auth }: { branchId: string; auth: AuthOpts }) {
  const roomsQuery = useRoomsQuery(branchId, auth);
  const createMutation = useCreateWorkOrderMutation(branchId, auth);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [priority, setPriority] = useState('medium');
  const [blockRoom, setBlockRoom] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const roomOptions: SelectOption[] = (roomsQuery.data ?? []).map((r) => ({ value: r.id, label: `Room ${r.number}` }));

  async function handleSubmit() {
    setError(null);
    setSuccess(false);
    try {
      await createMutation.mutateAsync({ title, description: description || undefined, roomId: roomId ?? undefined, priority: priority as MaintenancePriority, blockRoom });
      setTitle('');
      setDescription('');
      setRoomId(null);
      setPriority('medium');
      setBlockRoom(false);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <Section label="Submit a Work Order">
      <Card tone="accent" className="flex flex-col gap-3 max-w-xl">
        <Input id="wo-title" label="Title" placeholder="e.g. AC not cooling in 204" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea id="wo-description" label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <Select id="wo-room" label="Room (optional — leave blank for a common-area issue)" options={roomOptions} value={roomId} onChange={setRoomId} placeholder="Common area" />
        <Select id="wo-priority" label="Priority" options={PRIORITY_OPTIONS} value={priority} onChange={setPriority} />
        {roomId ? <YesNoToggle label="Block this room until resolved" name="blockRoom" value={blockRoom ? 'yes' : 'no'} onChange={(v) => setBlockRoom(v === 'yes')} /> : null}
        {error ? <p className="text-small text-red-600">{error}</p> : null}
        {success ? <p className="text-small text-green-700">Work order submitted.</p> : null}
        <div>
          <Button type="button" onClick={handleSubmit} disabled={createMutation.isPending || !title}>
            {createMutation.isPending ? 'Submitting…' : 'Submit Work Order'}
          </Button>
        </div>
      </Card>
    </Section>
  );
}

function WorkOrderDetailModal({ order, branchId, auth, onClose }: { order: WorkOrder | null; branchId: string; auth: AuthOpts; onClose: () => void }) {
  if (!order) return null;
  return <WorkOrderDetailModalInner key={order.id} order={order} branchId={branchId} auth={auth} onClose={onClose} />;
}

function WorkOrderDetailModalInner({ order, branchId, auth, onClose }: { order: WorkOrder; branchId: string; auth: AuthOpts; onClose: () => void }) {
  const staffQuery = useStaffQuery(branchId, auth);
  const updateMutation = useUpdateWorkOrderMutation(branchId, auth);
  const [status, setStatus] = useState<string>(order.status);
  const [assignedTo, setAssignedTo] = useState<string | null>(order.assignedToUser?.id ?? null);
  const [completionNotes, setCompletionNotes] = useState(order.completionNotes ?? '');
  const [partsUsed, setPartsUsed] = useState(order.partsUsed.join(', '));
  const [error, setError] = useState<string | null>(null);

  const staffOptions: SelectOption[] = (staffQuery.data ?? []).filter((s) => s.active).map((s) => ({ value: s.id, label: s.name }));

  async function handleSave() {
    setError(null);
    try {
      await updateMutation.mutateAsync({
        orderId: order.id,
        status: status as MaintenanceStatus,
        assignedTo: assignedTo ?? undefined,
        completionNotes: completionNotes || undefined,
        partsUsed: partsUsed
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean),
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <Modal open onClose={onClose} title={order.title}>
      <p className="text-small text-secondary-light">
        {order.room ? `Room ${order.room.number}` : 'Common area'} — reported by {order.reportedByUser?.name ?? 'Unknown'}
        {order.takesRoomOutOfService ? ' — this order is holding the room out of service' : ''}
      </p>
      {order.description ? <p className="text-body text-secondary">{order.description}</p> : null}
      <Select id="wo-status" label="Status" options={STATUS_OPTIONS} value={status} onChange={setStatus} />
      <Select id="wo-assigned-to" label="Assign to" options={staffOptions} value={assignedTo} onChange={setAssignedTo} placeholder="Unassigned" />
      <Textarea id="wo-completion-notes" label="Completion notes" value={completionNotes} onChange={(e) => setCompletionNotes(e.target.value)} />
      <Input id="wo-parts-used" label="Parts used (comma-separated)" value={partsUsed} onChange={(e) => setPartsUsed(e.target.value)} />
      {error ? <p className="text-small text-red-600">{error}</p> : null}
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </Modal>
  );
}

function WorkOrderBoard({ branchId, auth }: { branchId: string; auth: AuthOpts }) {
  const workOrdersQuery = useWorkOrdersQuery(branchId, auth);
  const [detailTarget, setDetailTarget] = useState<WorkOrder | null>(null);

  const orders = workOrdersQuery.data ?? [];

  return (
    <Section label="Work Order Board">
      {workOrdersQuery.isLoading ? (
        <p className="text-body text-primary-dark/70">Loading work orders…</p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {STATUS_COLUMNS.map((col) => {
            const columnOrders = orders.filter((o) => o.status === col.status);
            return (
              <div key={col.status} className={`flex flex-col gap-2 min-w-64 shrink-0 ${col.status === 'cancelled' ? 'opacity-60' : ''}`}>
                <p className="text-tiny font-bold uppercase tracking-wide text-primary-dark/50">
                  {col.label} ({columnOrders.length})
                </p>
                <div className="flex flex-col gap-2">
                  {columnOrders.map((o) => (
                    <button key={o.id} type="button" onClick={() => setDetailTarget(o)} className="text-left">
                      <Card tone="secondary" className="flex flex-col gap-1.5 hover:bg-secondary/10 transition-colors">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-small font-semibold text-secondary">{o.title}</span>
                          <PriorityBadge priority={o.priority} />
                        </div>
                        <span className="text-tiny text-secondary-light">{o.room ? `Room ${o.room.number}` : 'Common area'}</span>
                        {o.assignedToUser ? <span className="text-tiny text-secondary-light">Assigned: {o.assignedToUser.name}</span> : null}
                      </Card>
                    </button>
                  ))}
                  {columnOrders.length === 0 ? <p className="text-tiny text-secondary-light">Nothing here.</p> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <WorkOrderDetailModal order={detailTarget} branchId={branchId} auth={auth} onClose={() => setDetailTarget(null)} />
    </Section>
  );
}

function AssetModal({ open, onClose, branchId, auth }: { open: boolean; onClose: () => void; branchId: string; auth: AuthOpts }) {
  if (!open) return null;
  return <AssetModalInner onClose={onClose} branchId={branchId} auth={auth} />;
}

function AssetModalInner({ onClose, branchId, auth }: { onClose: () => void; branchId: string; auth: AuthOpts }) {
  const roomsQuery = useRoomsQuery(branchId, auth);
  const createMutation = useCreateAssetMutation(branchId, auth);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [purchaseDate, setPurchaseDate] = useState('');
  const [warrantyUntil, setWarrantyUntil] = useState('');
  const [serviceIntervalDays, setServiceIntervalDays] = useState('');
  const [error, setError] = useState<string | null>(null);

  const roomOptions: SelectOption[] = (roomsQuery.data ?? []).map((r) => ({ value: r.id, label: `Room ${r.number}` }));
  const categoryOptions: SelectOption[] = ['hvac', 'plumbing', 'electrical', 'furniture', 'appliance'].map((c) => ({ value: c, label: c }));

  async function handleSubmit() {
    setError(null);
    try {
      await createMutation.mutateAsync({
        name,
        category: category || undefined,
        roomId: roomId ?? undefined,
        purchaseDate: purchaseDate || undefined,
        warrantyUntil: warrantyUntil || undefined,
        serviceIntervalDays: serviceIntervalDays ? Number(serviceIntervalDays) : undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <Modal open onClose={onClose} title="Add Asset">
      <Input id="asset-name" label="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <Select id="asset-category" label="Category (optional)" options={categoryOptions} value={category || null} onChange={setCategory} placeholder="Select a category" />
      <Select id="asset-room" label="Room (optional — leave blank for a common-area asset)" options={roomOptions} value={roomId} onChange={setRoomId} placeholder="Common area" />
      <Input id="asset-purchase-date" label="Purchase Date (optional)" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
      <Input id="asset-warranty-until" label="Warranty Until (optional)" type="date" value={warrantyUntil} onChange={(e) => setWarrantyUntil(e.target.value)} />
      <Input
        id="asset-service-interval"
        label="Service Interval (days, optional)"
        type="number"
        min={1}
        value={serviceIntervalDays}
        onChange={(e) => setServiceIntervalDays(e.target.value)}
      />
      {error ? <p className="text-small text-red-600">{error}</p> : null}
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={createMutation.isPending || !name}>
          {createMutation.isPending ? 'Saving…' : 'Add Asset'}
        </Button>
      </div>
    </Modal>
  );
}

function warrantyBadge(warrantyUntil: string | null): { text: string; className: string } | null {
  if (!warrantyUntil) return null;
  const daysLeft = Math.ceil((new Date(warrantyUntil).getTime() - Date.now()) / 86_400_000);
  if (daysLeft < 0) return { text: 'Expired', className: 'text-red-600 font-semibold' };
  if (daysLeft <= 30) return { text: `${daysLeft}d left`, className: 'text-orange-600 font-semibold' };
  return { text: new Date(warrantyUntil).toLocaleDateString(), className: 'text-secondary-light' };
}

function AssetRegistrySection({ branchId, auth }: { branchId: string; auth: AuthOpts }) {
  const assetsQuery = useAssetsQuery(branchId, auth);
  const [modalOpen, setModalOpen] = useState(false);

  const columns: TableColumn<MaintenanceAsset>[] = [
    { key: 'name', label: 'Name', render: (a) => a.name, sortValue: (a) => a.name },
    { key: 'category', label: 'Category', render: (a) => a.category ?? '—' },
    { key: 'room', label: 'Location', render: (a) => (a.room ? `Room ${a.room.number}` : 'Common area') },
    {
      key: 'warranty',
      label: 'Warranty',
      render: (a) => {
        const badge = warrantyBadge(a.warrantyUntil);
        return badge ? <span className={badge.className}>{badge.text}</span> : <span className="text-secondary-light">—</span>;
      },
    },
    {
      key: 'nextServiceDue',
      label: 'Next Service Due',
      render: (a) => {
        if (!a.nextServiceDue) return <span className="text-secondary-light">—</span>;
        const overdue = new Date(a.nextServiceDue).getTime() < Date.now();
        return <span className={overdue ? 'text-red-600 font-semibold' : ''}>{new Date(a.nextServiceDue).toLocaleDateString()}</span>;
      },
      sortValue: (a) => a.nextServiceDue ?? '',
    },
  ];

  return (
    <Section label="Asset Registry">
      <div className="flex flex-col gap-3">
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setModalOpen(true)}>
            Add Asset
          </Button>
        </div>
        {assetsQuery.isLoading ? (
          <p className="text-body text-primary-dark/70">Loading assets…</p>
        ) : (
          <Card tone="secondary">
            <Table columns={columns} rows={assetsQuery.data ?? []} emptyMessage="No assets registered yet." exportFileName="assets" />
          </Card>
        )}
      </div>
      <AssetModal open={modalOpen} onClose={() => setModalOpen(false)} branchId={branchId} auth={auth} />
    </Section>
  );
}

/**
 * Maintenance (pms-frontend-structure-2.html's own `page-maintenance`) —
 * fourth of the 11 Management/Admin gaps, and the first needing a fully
 * new backend module: `MaintenanceOrder`/`Asset` Prisma models existed
 * since P0 but nothing had ever read or written them (see the backend's
 * own PHASE_NOTES.md). No drag-and-drop board — status changes go through
 * a detail modal's own Select, matching this app's established restraint
 * around new client-side libraries (no charting library, no DnD library).
 */
export default function MaintenancePage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  if (!activeBranchId) return null;

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader icon={<MaintenanceIcon className="size-8" />} title="Maintenance" subtitle="Work orders, asset tracking, and out-of-service rooms" />

      <WorkOrderSubmissionSection branchId={activeBranchId} auth={auth} />
      <WorkOrderBoard branchId={activeBranchId} auth={auth} />
      <AssetRegistrySection branchId={activeBranchId} auth={auth} />
    </Container>
  );
}
