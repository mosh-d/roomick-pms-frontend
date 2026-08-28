import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';
import { roomsQueryKey } from './rooms';

export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'skipped';

/** Mirrors `HousekeepingService`'s `TASK_INCLUDE` response shape (roomick-pms-backend/src/modules/housekeeping/housekeeping.service.ts). */
export interface HousekeepingTask {
  id: string;
  roomId: string;
  assigneeId: string | null;
  taskDate: string;
  status: TaskStatus;
  priority: number | null;
  triggerEvent: string | null;
  triggeredByReservationId: string | null;
  notes: string | null;
  completedAt: string | null;
  completedBy: string | null;
  createdAt: string;
  room: { id: string; number: string };
}

export interface HousekeeperSummary {
  id: string;
  name: string;
  email: string;
}

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

function tasksQueryKey(branchId: string, filter: { status?: TaskStatus; assigneeId?: string }) {
  return ['housekeeping-tasks', branchId, filter.status ?? null, filter.assigneeId ?? null] as const;
}

export function useHousekeepingTasksQuery(
  branchId: string | null,
  filter: { status?: TaskStatus; assigneeId?: string },
  { accessToken, tenantId }: AuthOpts,
) {
  const params = new URLSearchParams();
  if (filter.status) params.set('status', filter.status);
  if (filter.assigneeId) params.set('assigneeId', filter.assigneeId);
  const qs = params.toString();
  return useQuery({
    queryKey: tasksQueryKey(branchId ?? '', filter),
    queryFn: () => apiFetch<HousekeepingTask[]>(`/branches/${branchId}/housekeeping/tasks${qs ? `?${qs}` : ''}`, { accessToken, tenantId }),
    enabled: branchId !== null,
  });
}

export function useHousekeepersQuery(branchId: string | null, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['housekeeping-staff', branchId ?? ''] as const,
    queryFn: () => apiFetch<HousekeeperSummary[]>(`/branches/${branchId}/housekeeping/staff`, { accessToken, tenantId }),
    enabled: branchId !== null,
  });
}

export function useCreateTaskMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { roomId: string; priority?: number; notes?: string }) =>
      apiFetch<HousekeepingTask>(`/branches/${branchId}/housekeeping/tasks`, { method: 'POST', accessToken, tenantId, body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['housekeeping-tasks', branchId] }),
  });
}

/** Every task action moves a room through the cleanliness ladder too, so the Room Status Board's own query goes stale alongside the task lists. */
function invalidateAfterTaskChange(queryClient: ReturnType<typeof useQueryClient>, branchId: string) {
  queryClient.invalidateQueries({ queryKey: ['housekeeping-tasks', branchId] });
  queryClient.invalidateQueries({ queryKey: roomsQueryKey(branchId) });
}

export function useAssignTaskMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, assigneeId }: { taskId: string; assigneeId: string }) =>
      apiFetch<HousekeepingTask>(`/housekeeping/tasks/${taskId}/assign`, { method: 'POST', accessToken, tenantId, body: { assigneeId } }),
    onSuccess: () => invalidateAfterTaskChange(queryClient, branchId),
  });
}

export function useStartTaskMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => apiFetch<HousekeepingTask>(`/housekeeping/tasks/${taskId}/start`, { method: 'POST', accessToken, tenantId }),
    onSuccess: () => invalidateAfterTaskChange(queryClient, branchId),
  });
}

export function useCompleteTaskMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => apiFetch<HousekeepingTask>(`/housekeeping/tasks/${taskId}/complete`, { method: 'POST', accessToken, tenantId }),
    onSuccess: () => invalidateAfterTaskChange(queryClient, branchId),
  });
}

export function useReportIssueMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, areaOfIssue, description }: { taskId: string; areaOfIssue: string; description: string }) =>
      apiFetch<HousekeepingTask>(`/housekeeping/tasks/${taskId}/report-issue`, { method: 'POST', accessToken, tenantId, body: { areaOfIssue, description } }),
    onSuccess: () => invalidateAfterTaskChange(queryClient, branchId),
  });
}

/** Mirrors `RoomsService.listActiveBlocks`'s response shape. */
export interface RoomBlockRow {
  id: string;
  roomId: string;
  reason: 'maintenance' | 'renovation' | 'vip_hold' | 'other';
  fromDate: string;
  toDate: string;
  notes: string | null;
  room: { id: string; number: string };
}

export function useActiveBlocksQuery(branchId: string | null, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['room-blocks', branchId ?? ''] as const,
    queryFn: () => apiFetch<RoomBlockRow[]>(`/branches/${branchId}/room-blocks`, { accessToken, tenantId }),
    enabled: branchId !== null,
  });
}

export function useBlockRoomMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roomId, ...body }: { roomId: string; reason: string; fromDate: string; toDate: string; notes?: string }) =>
      apiFetch<RoomBlockRow>(`/rooms/${roomId}/block`, { method: 'POST', accessToken, tenantId, body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room-blocks', branchId] });
      queryClient.invalidateQueries({ queryKey: roomsQueryKey(branchId) });
    },
  });
}

export function useUnblockRoomMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (blockId: string) => apiFetch<RoomBlockRow>(`/room-blocks/${blockId}/end`, { method: 'POST', accessToken, tenantId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room-blocks', branchId] });
      queryClient.invalidateQueries({ queryKey: roomsQueryKey(branchId) });
    },
  });
}
