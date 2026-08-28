'use client';

import { useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select, type SelectOption } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { ShiftIcon } from '@/components/ui/Icons';
import {
  useCurrentShiftQuery,
  useHandoverContextQuery,
  useShiftHistoryQuery,
  useShiftQuery,
  useOpenShiftMutation,
  useCloseShiftMutation,
  useAddShiftIssueMutation,
  useUpdateShiftIssueMutation,
  type CashDenomination,
  type IssuePriority,
  type Shift,
  type ShiftIssue,
  type ShiftType,
} from '@/lib/shifts';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';

const SHIFT_TYPE_OPTIONS: SelectOption[] = [
  { value: 'morning', label: 'Morning' },
  { value: 'evening', label: 'Evening' },
  { value: 'night', label: 'Night' },
];

const PRIORITY_OPTIONS: SelectOption[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const PRIORITY_TONE: Record<IssuePriority, string> = {
  low: 'bg-secondary-light/20 text-secondary',
  medium: 'bg-amber-100 text-amber-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-700',
};

function sumDenominations(rows: CashDenomination[]): number {
  return rows.reduce((total, row) => total + row.denomination * row.count, 0);
}

/**
 * Shared open/close denomination counter (ref: "A table with one row per
 * currency denomination... total is calculated automatically"). No fixed
 * currency denominations are hardcoded — branches use different currencies,
 * so the agent adds whichever notes/coins they're actually counting.
 */
function DenominationCounter({ rows, onChange }: { rows: CashDenomination[]; onChange: (rows: CashDenomination[]) => void }) {
  function updateRow(index: number, patch: Partial<CashDenomination>) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }
  function addRow() {
    onChange([...rows, { denomination: 0, count: 0 }]);
  }
  function removeRow(index: number) {
    onChange(rows.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, i) => (
        <div key={i} className="flex items-end gap-3">
          <div className="w-32">
            <Input
              name={`denom-${i}`}
              label="Denomination"
              type="number"
              min={0}
              value={row.denomination || ''}
              onChange={(e) => updateRow(i, { denomination: Number(e.target.value) })}
            />
          </div>
          <div className="w-24">
            <Input name={`count-${i}`} label="Count" type="number" min={0} value={row.count || ''} onChange={(e) => updateRow(i, { count: Number(e.target.value) })} />
          </div>
          <p className="text-small text-primary-dark/70 pb-2">= {(row.denomination * row.count).toFixed(2)}</p>
          <button type="button" onClick={() => removeRow(i)} className="text-small text-red-600 pb-2 cursor-pointer">
            Remove
          </button>
        </div>
      ))}
      <div className="flex items-center gap-4">
        <Button type="button" variant="outline" onClick={addRow} className="self-start">
          Add Denomination
        </Button>
        <p className="text-small font-semibold text-primary-dark">Total: {sumDenominations(rows).toFixed(2)}</p>
      </div>
    </div>
  );
}

function varianceTone(variance: string | null): string {
  if (variance === null) return 'bg-secondary-light/20 text-secondary';
  const n = Number(variance);
  if (n === 0) return 'bg-secondary-light/20 text-secondary';
  return n > 0 ? 'bg-green-50 text-green-700' : 'bg-red-100 text-red-700';
}

export default function ShiftManagementPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const currentShiftQuery = useCurrentShiftQuery(activeBranchId, auth);
  const handoverQuery = useHandoverContextQuery(activeBranchId, auth);
  const historyQuery = useShiftHistoryQuery(activeBranchId, auth);

  if (!activeBranchId) return null;

  return (
    <Container className="max-w-5xl py-10 flex flex-col gap-8">
      <PageHeader icon={<ShiftIcon className="size-8" />} title="Shift Management" subtitle="Cash drawer, handover, unresolved issues" />

      {currentShiftQuery.isLoading ? (
        <p className="text-body text-primary-dark/70">Loading…</p>
      ) : currentShiftQuery.data ? (
        <OpenShiftDetail shiftId={currentShiftQuery.data.id} branchId={activeBranchId} auth={auth} />
      ) : (
        <OpenShiftForm branchId={activeBranchId} auth={auth} handover={handoverQuery.data} />
      )}

      <Section label="Shift History">
        {historyQuery.isLoading ? (
          <p className="text-body text-primary-dark/70">Loading…</p>
        ) : (historyQuery.data ?? []).length === 0 ? (
          <p className="text-body text-primary-dark/70">No shifts recorded yet at this branch.</p>
        ) : (
          <Card tone="secondary" className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-small font-bold text-secondary text-left">
                  <th className="py-2 pr-4">Agent</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Opened</th>
                  <th className="py-2 pr-4">Closed</th>
                  <th className="py-2 pr-4">Variance</th>
                  <th className="py-2 pr-4">Issues</th>
                </tr>
              </thead>
              <tbody>
                {(historyQuery.data ?? []).map((shift) => (
                  <tr key={shift.id} className="border-t border-secondary/10 text-small text-secondary">
                    <td className="py-2 pr-4">{shift.agent?.name ?? '—'}</td>
                    <td className="py-2 pr-4 capitalize">{shift.shiftType}</td>
                    <td className="py-2 pr-4">{new Date(shift.openedAt).toLocaleString()}</td>
                    <td className="py-2 pr-4">{shift.closedAt ? new Date(shift.closedAt).toLocaleString() : 'Open'}</td>
                    <td className="py-2 pr-4">
                      {shift.variance !== null ? (
                        <span className={`inline-flex items-center rounded-pill px-2 py-0.5 text-tiny font-semibold ${varianceTone(shift.variance)}`}>{shift.variance}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2 pr-4">{(shift.issues ?? []).filter((i) => i.status !== 'resolved').length} unresolved</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </Section>
    </Container>
  );
}

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

function OpenShiftForm({ branchId, auth, handover }: { branchId: string; auth: AuthOpts; handover: { lastClosedShift: Shift | null; unresolvedIssues: ShiftIssue[] } | undefined }) {
  const [shiftType, setShiftType] = useState<string | null>('morning');
  const [openingFloat, setOpeningFloat] = useState('');
  const [breakdown, setBreakdown] = useState<CashDenomination[]>([]);
  const [error, setError] = useState<string | null>(null);
  const mutation = useOpenShiftMutation(branchId, auth);

  async function submit() {
    if (!shiftType || !openingFloat) return;
    setError(null);
    try {
      await mutation.mutateAsync({
        shiftType: shiftType as ShiftType,
        openingFloat: Number(openingFloat),
        openingBreakdown: breakdown.length > 0 ? breakdown : undefined,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {handover?.lastClosedShift?.handoverNotes || (handover?.unresolvedIssues.length ?? 0) > 0 ? (
        <Section label="Handover">
          {handover?.lastClosedShift?.handoverNotes ? (
            <Card tone="accent">
              <p className="text-small font-semibold text-primary-dark mb-1">Notes from the last shift</p>
              <p className="text-body text-primary-dark">{handover.lastClosedShift.handoverNotes}</p>
            </Card>
          ) : null}
          {(handover?.unresolvedIssues ?? []).length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-small font-semibold text-primary-dark">Unresolved issues carried forward</p>
              {handover!.unresolvedIssues.map((issue) => (
                <IssueRow key={issue.id} issue={issue} branchId={branchId} auth={auth} />
              ))}
            </div>
          ) : null}
        </Section>
      ) : null}

      <Section label="Open Shift">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 max-w-xl">
          <Select name="shiftType" label="Shift Type" options={SHIFT_TYPE_OPTIONS} value={shiftType} onChange={setShiftType} />
          <Input name="openingFloat" label="Opening Float" type="number" min={0} value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)} placeholder="50000" />
        </div>
        <p className="text-small font-semibold text-primary-dark">Opening Denomination Count (optional)</p>
        <DenominationCounter rows={breakdown} onChange={setBreakdown} />
        {error ? <p className="text-small text-red-600">{error}</p> : null}
        <Button type="button" disabled={!shiftType || !openingFloat} loading={mutation.isPending} onClick={submit} className="self-start">
          Open Shift
        </Button>
      </Section>
    </div>
  );
}

function IssueRow({ issue, branchId, auth }: { issue: ShiftIssue; branchId: string; auth: AuthOpts }) {
  const mutation = useUpdateShiftIssueMutation(branchId, auth);
  const [error, setError] = useState<string | null>(null);

  async function act(status: 'resolved' | 'carried_over') {
    setError(null);
    try {
      await mutation.mutateAsync({ issueId: issue.id, status });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <Card tone="secondary" className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-body text-secondary">{issue.description}</p>
          {issue.shift ? (
            <p className="text-tiny text-secondary-light">
              From {issue.shift.agent.name}&rsquo;s {issue.shift.shiftType} shift, {new Date(issue.shift.openedAt).toLocaleDateString()}
            </p>
          ) : null}
        </div>
        <span className={`inline-flex items-center rounded-pill px-2 py-0.5 text-tiny font-semibold whitespace-nowrap ${PRIORITY_TONE[issue.priority]}`}>{issue.priority}</span>
      </div>
      {error ? <p className="text-small text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" loading={mutation.isPending} onClick={() => act('resolved')}>
          Resolve
        </Button>
        <Button type="button" variant="outline" size="sm" loading={mutation.isPending} onClick={() => act('carried_over')}>
          Carry Over
        </Button>
      </div>
    </Card>
  );
}

function OpenShiftDetail({ shiftId, branchId, auth }: { shiftId: string; branchId: string; auth: AuthOpts }) {
  const shiftQuery = useShiftQuery(shiftId, auth);
  const [issueDescription, setIssueDescription] = useState('');
  const [issuePriority, setIssuePriority] = useState<string | null>('medium');
  const addIssueMutation = useAddShiftIssueMutation(branchId, auth);

  const shift = shiftQuery.data;
  if (!shift) return <p className="text-body text-primary-dark/70">Loading…</p>;

  const cashPayments = (shift.payments ?? []).filter((p) => p.method === 'cash');
  const cashTakenSoFar = cashPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const unresolvedIssues = (shift.issues ?? []).filter((i) => i.status !== 'resolved');

  async function addIssue() {
    if (!issueDescription.trim()) return;
    await addIssueMutation.mutateAsync({ shiftId, description: issueDescription.trim(), priority: (issuePriority as IssuePriority) ?? 'medium' });
    setIssueDescription('');
    setIssuePriority('medium');
  }

  return (
    <div className="flex flex-col gap-8">
      <Section label="Current Shift">
        <Card tone="accent" className="flex flex-wrap gap-x-8 gap-y-2">
          <div>
            <p className="text-tiny text-primary-dark/70">Type</p>
            <p className="text-body font-semibold capitalize text-primary-dark">{shift.shiftType}</p>
          </div>
          <div>
            <p className="text-tiny text-primary-dark/70">Opened</p>
            <p className="text-body font-semibold text-primary-dark">{new Date(shift.openedAt).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-tiny text-primary-dark/70">Opening Float</p>
            <p className="text-body font-semibold text-primary-dark">{shift.openingFloat}</p>
          </div>
          <div>
            <p className="text-tiny text-primary-dark/70">Cash Taken So Far</p>
            <p className="text-body font-semibold text-primary-dark">{cashTakenSoFar.toFixed(2)}</p>
          </div>
        </Card>
      </Section>

      <Section label="Shift Issues">
        {unresolvedIssues.length === 0 ? <p className="text-body text-primary-dark/70">No open issues on this shift.</p> : null}
        <div className="flex flex-col gap-2">
          {unresolvedIssues.map((issue) => (
            <IssueRow key={issue.id} issue={issue} branchId={branchId} auth={auth} />
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3 max-w-xl">
          <div className="flex-1 min-w-48">
            <Input name="issueDescription" label="Log an Issue" value={issueDescription} onChange={(e) => setIssueDescription(e.target.value)} placeholder="POS terminal 2 offline" />
          </div>
          <div className="w-36">
            <Select name="issuePriority" label="Priority" options={PRIORITY_OPTIONS} value={issuePriority} onChange={setIssuePriority} />
          </div>
          <Button type="button" variant="outline" disabled={!issueDescription.trim()} loading={addIssueMutation.isPending} onClick={addIssue}>
            Add Issue
          </Button>
        </div>
      </Section>

      <CloseShiftForm shift={shift} branchId={branchId} auth={auth} />
    </div>
  );
}

function CloseShiftForm({ shift, branchId, auth }: { shift: Shift; branchId: string; auth: AuthOpts }) {
  const [closingCashCounted, setClosingCashCounted] = useState('');
  const [breakdown, setBreakdown] = useState<CashDenomination[]>([]);
  const [varianceExplanation, setVarianceExplanation] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [handoffIssues, setHandoffIssues] = useState<Array<{ description: string; priority?: IssuePriority }>>([]);
  const [newIssueText, setNewIssueText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mutation = useCloseShiftMutation(branchId, auth);

  function addHandoffIssue() {
    if (!newIssueText.trim()) return;
    setHandoffIssues([...handoffIssues, { description: newIssueText.trim() }]);
    setNewIssueText('');
  }

  async function submit() {
    if (!closingCashCounted) return;
    setError(null);
    try {
      await mutation.mutateAsync({
        shiftId: shift.id,
        closingCashCounted: Number(closingCashCounted),
        closingBreakdown: breakdown.length > 0 ? breakdown : undefined,
        varianceExplanation: varianceExplanation.trim() || undefined,
        handoverNotes: handoverNotes.trim() || undefined,
        unresolvedIssues: handoffIssues.length > 0 ? handoffIssues : undefined,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <Section label="Close Shift">
      <div className="max-w-xl">
        <Input
          name="closingCashCounted"
          label="Cash Counted"
          type="number"
          min={0}
          value={closingCashCounted}
          onChange={(e) => setClosingCashCounted(e.target.value)}
          placeholder={shift.openingFloat}
        />
      </div>
      <p className="text-small font-semibold text-primary-dark">Closing Denomination Count (optional)</p>
      <DenominationCounter rows={breakdown} onChange={setBreakdown} />

      <div className="max-w-xl">
        <Input name="varianceExplanation" label="Variance Explanation (if any)" value={varianceExplanation} onChange={(e) => setVarianceExplanation(e.target.value)} />
      </div>
      <div className="max-w-xl">
        <Textarea name="handoverNotes" label="Handover Notes" value={handoverNotes} onChange={(e) => setHandoverNotes(e.target.value)} />
      </div>

      <div className="flex flex-col gap-2 max-w-xl">
        <p className="text-small font-semibold text-primary-dark">Hand Off to Next Shift</p>
        {handoffIssues.map((issue, i) => (
          <p key={i} className="text-small text-primary-dark/80">
            • {issue.description}
          </p>
        ))}
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Input name="newIssueText" label="Note for the next agent" value={newIssueText} onChange={(e) => setNewIssueText(e.target.value)} placeholder="Room 214 minibar restock pending" />
          </div>
          <Button type="button" variant="outline" disabled={!newIssueText.trim()} onClick={addHandoffIssue}>
            Add
          </Button>
        </div>
      </div>

      {error ? <p className="text-small text-red-600">{error}</p> : null}
      <Button type="button" variant="danger" disabled={!closingCashCounted} loading={mutation.isPending} onClick={submit} className="self-start">
        Close Shift
      </Button>
    </Section>
  );
}
