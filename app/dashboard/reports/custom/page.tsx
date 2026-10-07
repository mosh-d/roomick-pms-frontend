'use client';

import { useMemo, useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { Table, type TableColumn } from '@/components/ui/Table';
import { PageHeader } from '@/components/ui/PageHeader';
import { CustomReportBuilderIcon, DownloadIcon } from '@/components/ui/Icons';
import { ApiError, downloadFile } from '@/lib/api';
import {
  useCatalogueQuery,
  useDeleteTemplateMutation,
  useReportTemplatesQuery,
  useRunReportMutation,
  useSaveTemplateMutation,
  type CustomReportResult,
  type ReportDefinition,
  type ReportFilter,
  type ReportTemplate,
} from '@/lib/customReports';
import { formatMoney } from '@/lib/numberFormat';
import { currencySymbolFor } from '@/lib/currencies';
import { useAuthStore } from '@/lib/store/authStore';

function lastThirtyDays(): { from: string; to: string } {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
  const end = new Date(`${today}T00:00:00Z`);
  return { from: new Date(end.getTime() - 29 * 86_400_000).toISOString().slice(0, 10), to: new Date(end.getTime() + 86_400_000).toISOString().slice(0, 10) };
}

const pretty = (value: string) => value.replace(/_/g, ' ');

/**
 * Custom Report Builder (ref: "Select fields, filters, groupings, save
 * templates" — field picker, filter rows, group by, preview, save as
 * template). Built from the backend's catalogue: a dataset, its columns,
 * filters, an optional grouping (a count and the totals of each money and
 * number column), a sort, and the dates. The preview shows 500 rows; the CSV
 * has all of them. A report saves under a name and runs again for any dates.
 *
 * Scheduling (the reference's "Schedule report toggle") sends a report by
 * email, so it waits on an email provider — the owner checklist has it.
 */
export default function CustomReportBuilderPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const catalogueQuery = useCatalogueQuery(auth);
  const templatesQuery = useReportTemplatesQuery(activeBranchId, auth);
  const runMutation = useRunReportMutation(activeBranchId ?? '', auth);
  const saveMutation = useSaveTemplateMutation(activeBranchId ?? '', auth);
  const deleteMutation = useDeleteTemplateMutation(activeBranchId ?? '', auth);

  const [datasetKey, setDatasetKey] = useState<string>('reservations');
  const [fields, setFields] = useState<string[]>(['confirmationNumber', 'guestName', 'roomType', 'checkInDate', 'nights', 'roomTotal']);
  const [filters, setFilters] = useState<ReportFilter[]>([]);
  const [groupBy, setGroupBy] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [range, setRange] = useState(lastThirtyDays);
  const [templateName, setTemplateName] = useState('');
  const [result, setResult] = useState<CustomReportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const catalogue = catalogueQuery.data;
  const dataset = catalogue?.datasets.find((d) => d.key === datasetKey);
  const fieldByKey = useMemo(() => new Map((dataset?.fields ?? []).map((f) => [f.key, f])), [dataset]);

  const definition: ReportDefinition = {
    dataset: datasetKey,
    fields,
    filters: filters.filter((f) => f.field && f.operator && f.value.trim() !== ''),
    groupBy: groupBy || undefined,
    sortBy: sortBy || undefined,
    sortDir,
  };

  function pickDataset(key: string) {
    const next = catalogue?.datasets.find((d) => d.key === key);
    setDatasetKey(key);
    setFields(next ? next.fields.slice(0, 5).map((f) => f.key) : []);
    setFilters([]);
    setGroupBy('');
    setSortBy('');
    setResult(null);
  }

  function loadTemplate(template: ReportTemplate) {
    setDatasetKey(template.definition.dataset);
    setFields(template.definition.fields);
    setFilters(template.definition.filters ?? []);
    setGroupBy(template.definition.groupBy ?? '');
    setSortBy(template.definition.sortBy ?? '');
    setSortDir(template.definition.sortDir ?? 'asc');
    setTemplateName(template.name);
    setResult(null);
    setNotice(`Loaded "${template.name}" — pick the dates and run it.`);
  }

  async function run() {
    setError(null);
    setNotice(null);
    try {
      setResult(await runMutation.mutateAsync({ ...definition, from: range.from, to: range.to }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not run the report.');
    }
  }

  async function exportCsv() {
    if (!activeBranchId) return;
    setError(null);
    try {
      await downloadFile(`/branches/${activeBranchId}/reports/custom/csv`, `${datasetKey}-${range.from}-${range.to}.csv`, auth, { body: { ...definition, from: range.from, to: range.to } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not export the report.');
    }
  }

  async function save() {
    setError(null);
    setNotice(null);
    try {
      const saved = await saveMutation.mutateAsync({ name: templateName.trim(), definition });
      setNotice(`Saved as "${saved.name}".`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save the report.');
    }
  }

  if (!activeBranchId) return null;

  const fieldOptions: SelectOption[] = (dataset?.fields ?? []).map((f) => ({ value: f.key, label: f.label }));
  const groupOptions: SelectOption[] = [
    { value: '', label: 'No grouping — every row' },
    ...(dataset?.fields ?? []).filter((f) => f.type !== 'money' && f.type !== 'number').map((f) => ({ value: f.key, label: f.label })),
  ];
  const sortOptions: SelectOption[] = [
    { value: '', label: 'As found' },
    ...(groupBy
      ? [
          { value: groupBy, label: fieldByKey.get(groupBy)?.label ?? groupBy },
          { value: 'count', label: 'Count' },
          ...fields.filter((k) => ['money', 'number'].includes(fieldByKey.get(k)?.type ?? '')).map((k) => ({ value: k, label: `${fieldByKey.get(k)?.label} (total)` })),
        ]
      : fields.map((k) => ({ value: k, label: fieldByKey.get(k)?.label ?? k }))),
  ];

  const columns: TableColumn<Record<string, string | number | null> & { id: string }>[] = (result?.columns ?? []).map((c) => ({
    key: c.key,
    label: c.label,
    align: c.type === 'money' || c.type === 'number' ? ('right' as const) : undefined,
    render: (row) => {
      const value = row[c.key];
      if (value === null || value === undefined || value === '') return '—';
      if (c.type === 'money') return formatMoney(String(value), currencySymbolFor(result?.currency));
      if (c.type === 'enum') return pretty(String(value));
      return String(value);
    },
    sortValue: (row) => (c.type === 'money' || c.type === 'number' ? Number(row[c.key] ?? 0) : String(row[c.key] ?? '')),
  }));
  const rows = (result?.rows ?? []).map((row, index) => ({ ...row, id: String(index) }));

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader icon={<CustomReportBuilderIcon className="size-8" />} title="Custom Report Builder" subtitle="Pick the data, the columns and the filters — save it to run again." roles="Manager · Owner · Accountant" />

      {error ? <p className="text-small text-red-600">{error}</p> : null}
      {notice ? <p className="text-small text-green-700">{notice}</p> : null}

      {catalogueQuery.isLoading || !catalogue ? (
        <p className="text-body text-surface-muted">Loading…</p>
      ) : (
        <>
          <Section label="Data">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-2">
              <Select
                id="report-dataset"
                name="dataset"
                label="Report on"
                options={catalogue.datasets.map((d) => ({ value: d.key, label: d.label }))}
                value={datasetKey}
                onChange={pickDataset}
              />
              <Input label={`${dataset?.dateLabel ?? 'Between'} — from`} name="from" type="date" value={range.from} max={range.to} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
              <Input label="To (not included)" name="to" type="date" value={range.to} min={range.from} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
            </div>
          </Section>

          <Section label="Columns">
            <div className="flex flex-wrap gap-x-6 gap-y-2" role="group" aria-label="Columns to show">
              {(dataset?.fields ?? []).map((f) => (
                <label key={f.key} className="flex items-center gap-2 text-small text-surface cursor-pointer">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary cursor-pointer"
                    checked={fields.includes(f.key)}
                    onChange={(e) => setFields((prev) => (e.target.checked ? [...prev, f.key] : prev.filter((k) => k !== f.key)))}
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </Section>

          <Section label="Filters">
            {filters.length === 0 ? <p className="text-small text-surface-muted">No filters — every row in the dates.</p> : null}
            {filters.map((filter, index) => {
              const field = fieldByKey.get(filter.field);
              const operators = field ? catalogue.operators[field.type] : [];
              return (
                <div key={index} className="grid grid-cols-1 sm:grid-cols-[1fr_10rem_1fr_auto] gap-x-4 gap-y-2 items-end">
                  <Select
                    id={`filter-field-${index}`}
                    name={`filterField${index}`}
                    label="Column"
                    options={fieldOptions}
                    value={filter.field || null}
                    onChange={(value) => {
                      const type = fieldByKey.get(value)?.type ?? 'text';
                      setFilters((prev) => prev.map((f, i) => (i === index ? { field: value, operator: catalogue.operators[type][0].key, value: '' } : f)));
                    }}
                  />
                  <Select
                    id={`filter-operator-${index}`}
                    name={`filterOperator${index}`}
                    label="Is"
                    options={operators.map((op) => ({ value: op.key, label: op.label }))}
                    value={filter.operator || null}
                    onChange={(value) => setFilters((prev) => prev.map((f, i) => (i === index ? { ...f, operator: value } : f)))}
                  />
                  {field?.type === 'enum' ? (
                    <Select
                      id={`filter-value-${index}`}
                      name={`filterValue${index}`}
                      label="Value"
                      options={(field.options ?? []).map((o) => ({ value: o, label: pretty(o) }))}
                      value={filter.value || null}
                      onChange={(value) => setFilters((prev) => prev.map((f, i) => (i === index ? { ...f, value } : f)))}
                    />
                  ) : (
                    <Input
                      label="Value"
                      name={`filterValue${index}`}
                      type={field?.type === 'date' ? 'date' : field?.type === 'money' || field?.type === 'number' ? 'number' : 'text'}
                      value={filter.value}
                      onChange={(e) => setFilters((prev) => prev.map((f, i) => (i === index ? { ...f, value: e.target.value } : f)))}
                    />
                  )}
                  <Button type="button" size="sm" variant="outline" onClick={() => setFilters((prev) => prev.filter((_, i) => i !== index))}>
                    Remove
                  </Button>
                </div>
              );
            })}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="self-start"
              onClick={() => setFilters((prev) => [...prev, { field: dataset?.fields[0]?.key ?? '', operator: catalogue.operators[dataset?.fields[0]?.type ?? 'text'][0].key, value: '' }])}
            >
              Add Filter
            </Button>
          </Section>

          <Section label="Grouping & Order">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-2">
              <Select id="report-group-by" name="groupBy" label="Group by" options={groupOptions} value={groupBy} onChange={(v) => { setGroupBy(v); setSortBy(''); }} hint="A row per value, with a count and the totals of the money and number columns" />
              <Select id="report-sort-by" name="sortBy" label="Sort by" options={sortOptions} value={sortBy} onChange={setSortBy} />
              <Select
                id="report-sort-dir"
                name="sortDir"
                label="Order"
                options={[
                  { value: 'asc', label: 'Lowest / A first' },
                  { value: 'desc', label: 'Highest / Z first' },
                ]}
                value={sortDir}
                onChange={(v) => setSortDir(v as 'asc' | 'desc')}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={run} disabled={fields.length === 0} loading={runMutation.isPending}>
                Run Report
              </Button>
              <Button type="button" variant="outline" onClick={exportCsv} disabled={fields.length === 0}>
                <DownloadIcon className="size-4" /> CSV
              </Button>
            </div>
          </Section>

          {result ? (
            <Section label="Results">
              <p className="text-small text-surface-muted">
                {result.total.toLocaleString()} {result.total === 1 ? 'row' : 'rows'}
                {result.previewOnly ? ` — the first ${result.rows.length.toLocaleString()} shown; the CSV has them all` : ''}.
              </p>
              <Card tone="secondary">
                <Table columns={columns} rows={rows} emptyMessage="Nothing matches — widen the dates or loosen the filters." />
              </Card>
            </Section>
          ) : null}

          <Section label="Saved Reports">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-56">
                <Input label="Save this report as" name="templateName" value={templateName} onChange={(e) => setTemplateName(e.target.value)} maxLength={100} hint="Saving under a name that exists replaces that report" />
              </div>
              <Button type="button" variant="outline" onClick={save} disabled={!templateName.trim() || fields.length === 0} loading={saveMutation.isPending}>
                Save Report
              </Button>
            </div>
            {(templatesQuery.data ?? []).length === 0 ? (
              <p className="text-small text-surface-muted">No saved reports yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {(templatesQuery.data ?? []).map((template) => (
                  <li key={template.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/15 pb-2 last:border-0">
                    <div className="flex flex-col">
                      <span className="text-small font-semibold text-surface">{template.name}</span>
                      <span className="text-tiny text-surface-muted">
                        {catalogue.datasets.find((d) => d.key === template.definition.dataset)?.label ?? template.definition.dataset} · {template.definition.fields.length} columns
                        {template.definition.groupBy ? ` · grouped by ${fieldByKey.get(template.definition.groupBy)?.label ?? template.definition.groupBy}` : ''}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => loadTemplate(template)}>
                        Load
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => deleteMutation.mutate(template.id)}>
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-tiny text-surface-muted">Emailing a saved report on a schedule needs an email provider — it&apos;s on the owner checklist.</p>
          </Section>
        </>
      )}
    </Container>
  );
}
