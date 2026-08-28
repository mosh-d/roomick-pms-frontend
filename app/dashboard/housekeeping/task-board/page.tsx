'use client';

import { useMemo, useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { TaskBoardIcon } from '@/components/ui/Icons';
import {
  useHousekeepingTasksQuery,
  useStartTaskMutation,
  useCompleteTaskMutation,
  useReportIssueMutation,
  type HousekeepingTask,
} from '@/lib/housekeeping';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';

/**
 * Task Board (ref p28) — "Dirty Rooms" (pending, unclaimed or already mine)
 * with Start Cleaning / Report Issue, and "In Progress" (mine, in_progress)
 * with Complete / Report Issue. The reference's own Task Board also shows a
 * "Pending Inspections" section with a Mark Dirty action — left off here
 * because approving/rejecting a cleaned room is Inspection Workflow's own
 * job; showing the same action on two pages would be two places to keep in
 * sync for one real decision.
 */
export default function TaskBoardPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const [actionError, setActionError] = useState<string | null>(null);
  const [issueTask, setIssueTask] = useState<HousekeepingTask | null>(null);
  const [areaOfIssue, setAreaOfIssue] = useState('');
  const [description, setDescription] = useState('');

  const pendingQuery = useHousekeepingTasksQuery(activeBranchId, { status: 'pending' }, auth);
  const inProgressQuery = useHousekeepingTasksQuery(activeBranchId, { status: 'in_progress' }, auth);
  const startMutation = useStartTaskMutation(activeBranchId ?? '', auth);
  const completeMutation = useCompleteTaskMutation(activeBranchId ?? '', auth);
  const reportIssueMutation = useReportIssueMutation(activeBranchId ?? '', auth);

  const dirtyRooms = useMemo(
    () => (pendingQuery.data ?? []).filter((t) => !t.assigneeId || t.assigneeId === user?.id),
    [pendingQuery.data, user?.id],
  );
  const myInProgress = useMemo(
    () => (inProgressQuery.data ?? []).filter((t) => t.assigneeId === user?.id),
    [inProgressQuery.data, user?.id],
  );

  if (!activeBranchId) return null;

  async function handleStart(taskId: string) {
    setActionError(null);
    try {
      await startMutation.mutateAsync(taskId);
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  }

  async function handleComplete(taskId: string) {
    setActionError(null);
    try {
      await completeMutation.mutateAsync(taskId);
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  }

  async function submitIssue() {
    if (!issueTask) return;
    setActionError(null);
    try {
      await reportIssueMutation.mutateAsync({ taskId: issueTask.id, areaOfIssue, description });
      setIssueTask(null);
      setAreaOfIssue('');
      setDescription('');
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader icon={<TaskBoardIcon className="size-8" />} title="Task Board" subtitle="My assigned rooms + status actions" />

      {actionError ? <p className="text-small text-red-600">{actionError}</p> : null}

      <Section label="Dirty Rooms">
        {pendingQuery.isLoading ? (
          <p className="text-body text-primary-dark/70">Loading tasks…</p>
        ) : dirtyRooms.length === 0 ? (
          <p className="text-body text-primary-dark/70">No dirty rooms waiting right now.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {dirtyRooms.map((task) => (
              <Card key={task.id} tone="secondary" className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-body font-bold text-secondary">Room {task.room.number}</span>
                  {task.priority === 1 ? (
                    <span className="rounded-pill bg-red-100 px-2 py-0.5 text-tiny font-semibold text-red-700">Urgent</span>
                  ) : null}
                </div>
                <p className="text-small text-secondary-light border-b border-secondary/20 pb-2">Clean a room or report an issue</p>
                <div className="flex gap-2">
                  <Button size="sm" loading={startMutation.isPending} onClick={() => handleStart(task.id)}>
                    Start Cleaning
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setIssueTask(task)}>
                    Report Issue
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section label="In Progress">
        {inProgressQuery.isLoading ? (
          <p className="text-body text-primary-dark/70">Loading tasks…</p>
        ) : myInProgress.length === 0 ? (
          <p className="text-body text-primary-dark/70">Nothing in progress right now.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {myInProgress.map((task) => (
              <Card key={task.id} tone="secondary" className="flex flex-col gap-3">
                <span className="text-body font-bold text-secondary">Room {task.room.number}</span>
                <p className="text-small text-secondary-light border-b border-secondary/20 pb-2">Currently cleaning</p>
                <div className="flex gap-2">
                  <Button size="sm" loading={completeMutation.isPending} onClick={() => handleComplete(task.id)}>
                    Complete
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setIssueTask(task)}>
                    Report Issue
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Modal open={issueTask !== null} onClose={() => setIssueTask(null)} title={`Report an issue — Room ${issueTask?.room.number ?? ''}`}>
        <div className="flex flex-col gap-4">
          <Input label="Area of Issue" value={areaOfIssue} onChange={(e) => setAreaOfIssue(e.target.value)} placeholder="e.g. Bathroom" />
          <Textarea label="Describe Issue" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the issue you noticed" />
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" onClick={() => setIssueTask(null)}>
              Close
            </Button>
            <Button type="button" loading={reportIssueMutation.isPending} disabled={!areaOfIssue.trim() || !description.trim()} onClick={submitIssue}>
              Report
            </Button>
          </div>
        </div>
      </Modal>
    </Container>
  );
}
