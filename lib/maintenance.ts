import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

export type MaintenancePriority = 'low' | 'medium' | 'high' | 'urgent';
export type MaintenanceStatus = 'open' | 'in_progress' | 'on_hold' | 'resolved' | 'cancelled';

/** Mirrors `WORK_ORDER_INCLUDE`'s shape (roomick-pms-backend/src/modules/maintenance/maintenance.service.ts). */
export interface WorkOrder {
  id: string;
  title: string;
  description: string | null;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  takesRoomOutOfService: boolean;
  photoUrls: string[];
  completionNotes: string | null;
  partsUsed: string[];
  resolvedAt: string | null;
  createdAt: string;
  room: { id: string; number: string } | null;
  asset: { id: string; name: string } | null;
  reportedByUser: { id: string; name: string } | null;
  assignedToUser: { id: string; name: string } | null;
}

export interface MaintenanceAsset {
  id: string;
  name: string;
  category: string | null;
  serialNumber: string | null;
  purchaseDate: string | null;
  warrantyUntil: string | null;
  serviceIntervalDays: number | null;
  notes: string | null;
  room: { id: string; number: string } | null;
  /** Computed server-side — `purchaseDate + serviceIntervalDays`, null if either is missing. Not reset by a completed service order yet (see the backend's own comment). */
  nextServiceDue: string | null;
}

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

function workOrdersQueryKey(branchId: string) {
  return ['maintenance-work-orders', branchId] as const;
}

export function useWorkOrdersQuery(branchId: string | null, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: workOrdersQueryKey(branchId ?? ''),
    queryFn: () => apiFetch<WorkOrder[]>(`/branches/${branchId}/maintenance/work-orders`, { accessToken, tenantId }),
    enabled: branchId !== null,
  });
}

export function useCreateWorkOrderMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { title: string; description?: string; roomId?: string; priority?: MaintenancePriority; blockRoom?: boolean }) =>
      apiFetch<WorkOrder>(`/branches/${branchId}/maintenance/work-orders`, { method: 'POST', accessToken, tenantId, body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workOrdersQueryKey(branchId) });
      queryClient.invalidateQueries({ queryKey: ['rooms', branchId] });
    },
  });
}

export function useUpdateWorkOrderMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, ...body }: { orderId: string; status?: MaintenanceStatus; assignedTo?: string; completionNotes?: string; partsUsed?: string[] }) =>
      apiFetch<WorkOrder>(`/maintenance/work-orders/${orderId}`, { method: 'PATCH', accessToken, tenantId, body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workOrdersQueryKey(branchId) });
      queryClient.invalidateQueries({ queryKey: ['rooms', branchId] });
    },
  });
}

function assetsQueryKey(branchId: string) {
  return ['maintenance-assets', branchId] as const;
}

export function useAssetsQuery(branchId: string | null, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: assetsQueryKey(branchId ?? ''),
    queryFn: () => apiFetch<MaintenanceAsset[]>(`/branches/${branchId}/maintenance/assets`, { accessToken, tenantId }),
    enabled: branchId !== null,
  });
}

export function useCreateAssetMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; category?: string; roomId?: string; serialNumber?: string; purchaseDate?: string; warrantyUntil?: string; serviceIntervalDays?: number; notes?: string }) =>
      apiFetch<MaintenanceAsset>(`/branches/${branchId}/maintenance/assets`, { method: 'POST', accessToken, tenantId, body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: assetsQueryKey(branchId) }),
  });
}
