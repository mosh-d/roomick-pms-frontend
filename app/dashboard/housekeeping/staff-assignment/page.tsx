'use client';

import { useMemo, useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select, type SelectOption } from '@/components/ui/Select';
import { PageHeader } from '@/components/ui/PageHeader';
import { StaffAssignmentIcon } from '@/components/ui/Icons';
import { useHousekeepingTasksQuery, useHousekeepersQuery, useAssignTaskMutation } from '@/lib/housekeeping';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';

/** Staff Assignment (ref p29) — a supervisor distributes unclaimed dirty rooms to specific housekeepers, rather than leaving them to self-claim from Task Board. */
export default function StaffAssignmentPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const [selections, setSelections] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  const pendingQuery = useHousekeepingTasksQuery(activeBranchId, { status: 'pending' }, auth);
  const inProgressQuery = useHousekeepingTasksQuery(activeBranchId, { status: 'in_progress' }, auth);
  const housekeepersQuery = useHousekeepersQuery(activeBranchId, auth);
  const assignMutation = useAssignTaskMutation(activeBranchId ?? '', auth);

  const unassigned = useMemo(() => (pendingQuery.data ?? []).filter((t) => !t.assigneeId), [pendingQuery.data]);
  const idleHousekeepers = useMemo(() => {
    const busyIds = new Set((inProgressQuery.data ?? []).map((t) => t.assigneeId).filter(Boolean));
    return (housekeepersQuery.data ?? []).filter((h) => !busyIds.has(h.id));
  }, [housekeepersQuery.data, inProgressQuery.data]);

  const housekeeperOptions: SelectOption[] = (housekeepersQuery.data ?? []).map((h) => ({ value: h.id, label: h.name }));

  if (!activeBranchId) return null;

  async function assign(taskId: string) {
    const assigneeId = selections[taskId];
    if (!assigneeId) return;
    setActionError(null);
    try {
      await assignMutation.mutateAsync({ taskId, assigneeId });
      setSelections((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <Container className="max-w-5xl py-10 flex flex-col gap-8">
      <PageHeader icon={<StaffAssignmentIcon className="size-8" />} title="Staff Assignment" subtitle="Supervisor distributes rooms to housekeepers" />

      {actionError ? <p className="text-small text-red-600">{actionError}</p> : null}

      <Section label="Housekeepers">
        {housekeepersQuery.isLoading ? (
          <p className="text-body text-primary-dark/70">Loading housekeepers…</p>
        ) : (housekeepersQuery.data ?? []).length === 0 ? (
          <p className="text-body text-primary-dark/70">No housekeepers are on staff at this branch yet.</p>
        ) : (
          <p className="text-body text-primary-dark/80">
            {idleHousekeepers.length} idle · {(housekeepersQuery.data ?? []).length - idleHousekeepers.length} currently cleaning
          </p>
        )}
      </Section>

      <Section label="Rooms Ready for Cleaning">
        {pendingQuery.isLoading ? (
          <p className="text-body text-primary-dark/70">Loading rooms…</p>
        ) : unassigned.length === 0 ? (
          <p className="text-body text-primary-dark/70">Nothing unassigned right now.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {unassigned.map((task) => (
              <Card key={task.id} tone="secondary" className="flex items-center justify-between gap-4">
                <span className="text-body font-semibold text-secondary">Room {task.room.number}</span>
                <div className="flex items-center gap-3 w-72">
                  <div className="flex-1">
                    <Select
                      name={`assignee-${task.id}`}
                      label="Assign to"
                      options={housekeeperOptions}
                      value={selections[task.id] ?? null}
                      onChange={(value) => setSelections((prev) => ({ ...prev, [task.id]: value }))}
                    />
                  </div>
                  <Button size="sm" disabled={!selections[task.id]} loading={assignMutation.isPending} onClick={() => assign(task.id)}>
                    Assign
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>
    </Container>
  );
}
