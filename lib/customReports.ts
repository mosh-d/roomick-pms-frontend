import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

export type FieldType = 'text' | 'enum' | 'number' | 'money' | 'date';

/** Mirrors the backend's `custom-report.catalog.ts`. */
export interface CatalogField {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
}
export interface Dataset {
  key: string;
  label: string;
  dateLabel: string;
  fields: CatalogField[];
}
export interface Catalogue {
  datasets: Dataset[];
  operators: Record<FieldType, Array<{ key: string; label: string }>>;
}

export interface ReportFilter {
  field: string;
  operator: string;
  value: string;
}

export interface ReportDefinition {
  dataset: string;
  fields: string[];
  filters?: ReportFilter[];
  groupBy?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface ReportRun extends ReportDefinition {
  from: string;
  to: string;
}

export interface CustomReportResult {
  columns: Array<{ key: string; label: string; type: FieldType }>;
  rows: Array<Record<string, string | number | null>>;
  total: number;
  previewOnly: boolean;
  currency: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  definition: ReportDefinition & { groupBy: string | null; sortBy: string | null };
  createdAt: string;
  createdByUser: { name: string } | null;
}

export function useCatalogueQuery({ accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['custom-report-catalogue'] as const,
    queryFn: () => apiFetch<Catalogue>('/reports/custom/catalogue', { accessToken, tenantId }),
    enabled: tenantId !== undefined,
    staleTime: Infinity,
  });
}

export function useRunReportMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  return useMutation({
    mutationFn: (body: ReportRun) => apiFetch<CustomReportResult>(`/branches/${branchId}/reports/custom/run`, { method: 'POST', accessToken, tenantId, body }),
  });
}

const templatesKey = (branchId: string) => ['report-templates', branchId] as const;

export function useReportTemplatesQuery(branchId: string | null, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: templatesKey(branchId ?? ''),
    queryFn: () => apiFetch<ReportTemplate[]>(`/branches/${branchId}/reports/custom/templates`, { accessToken, tenantId }),
    enabled: branchId !== null,
  });
}

export function useSaveTemplateMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; definition: ReportDefinition }) =>
      apiFetch<ReportTemplate>(`/branches/${branchId}/reports/custom/templates`, { method: 'POST', accessToken, tenantId, body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: templatesKey(branchId) }),
  });
}

export function useDeleteTemplateMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) => apiFetch<void>(`/report-templates/${templateId}`, { method: 'DELETE', accessToken, tenantId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: templatesKey(branchId) }),
  });
}
