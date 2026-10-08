'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CheckIcon, XIcon, ReceiptIcon } from '@/components/ui/Icons';
import { ApiError } from '@/lib/api';
import {
  useNightAuditPreflightQuery,
  useNightAuditRunsQuery,
  useRunNightAuditMutation,
  type PreflightCheck,
  type NightAuditRunResult,
} from '@/lib/nightAudit';
import { formatMoney } from '@/lib/numberFormat';
import { currencySymbolFor } from '@/lib/currencies';
import { useAuthStore } from '@/lib/store/authStore';
import { formatDateOnly } from '@/lib/dates';

/**
 * Night Audit (Roomick-UI.pdf page 35) — end-of-day rollover: pre-audit
 * checks, what's still unresolved, and the trigger.
 *
 * The audit normally runs itself (an hourly sweep fires per branch once
 * its own local clock passes the audit hour — branches have their own
 * timezones, so a single fixed-time cron would be wrong for most of them).
 * This page is the manual path plus the visibility into it.
 *
 * Recent Runs is an addition to the reference: the spec's own health rule
 * ("a run stuck in `running` for over 10 minutes") is unobservable without
 * somewhere to see run history, and `night_audit_log` exists precisely to
 * record it.
 */
export default function NightAuditPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<NightAuditRunResult | null>(null);

  const preflightQuery = useNightAuditPreflightQuery(activeBranchId, auth);
  const runsQuery = useNightAuditRunsQuery(activeBranchId, auth);
  const runMutation = useRunNightAuditMutation(activeBranchId ?? '', auth);

  const preflight = preflightQuery.data;

  async function handleRun() {
    setRunError(null);
    try {
      setLastRun(await runMutation.mutateAsync(undefined));
    } catch (error) {
      setRunError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    } finally {
      setConfirmOpen(false);
    }
  }

  if (!activeBranchId) return null;

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader icon={<ReceiptIcon className="size-8" />} title="Night Audit" subtitle="End-of-day rollover and reconciliation" />

      {runError ? <p className="text-small text-red-600">{runError}</p> : null}
      {lastRun ? (
        <Card tone="secondary">
          <p className="text-small text-surface">
            <span className="font-bold">Audit {lastRun.status} for {lastRun.auditDate}.</span>{' '}
            {lastRun.chargesPosted} room {lastRun.chargesPosted === 1 ? 'charge' : 'charges'} posted across {lastRun.foliosProcessed}{' '}
            {lastRun.foliosProcessed === 1 ? 'folio' : 'folios'}
            {lastRun.noShowsMarked > 0 ? `, ${lastRun.noShowsMarked} no-show${lastRun.noShowsMarked === 1 ? '' : 's'} marked` : ''}.
            {lastRun.errors.length > 0 ? ` ${lastRun.errors.length} reservation(s) errored and were skipped.` : ''}
          </p>
        </Card>
      ) : null}

      {preflightQuery.isLoading ? (
        <p className="text-body text-surface-muted">Loading pre-audit checks…</p>
      ) : preflightQuery.isError || !preflight ? (
        <p className="text-body text-red-600">Could not load pre-audit information.</p>
      ) : (
        <>
          <Section label="Pre-Audit Info">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <Card tone="secondary" className="flex flex-col gap-3">
                <div>
                  <h3 className="text-body font-bold text-surface">Pre-audit Checklist</h3>
                  <p className="text-small text-surface-muted">Conditions that should be met before the night audit runs</p>
                </div>
                <div className="flex flex-col gap-2 pt-2 border-t border-secondary/20">
                  {preflight.checklist.map((item) => (
                    <ChecklistRow key={item.key} item={item} />
                  ))}
                </div>
              </Card>

              <Card tone="secondary" className="flex flex-col gap-3">
                <div>
                  <h3 className="text-body font-bold text-surface">Open Folios</h3>
                  <p className="text-small text-surface-muted">Folios still in open status ({preflight.openFolios.length})</p>
                </div>
                {preflight.openFolios.length === 0 ? (
                  <p className="text-small text-surface-muted pt-2 border-t border-secondary/20">No open folios.</p>
                ) : (
                  <div className="flex flex-col pt-2 border-t border-secondary/20 max-h-64 overflow-y-auto">
                    {preflight.openFolios.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => router.push(`/dashboard/billing/${f.id}`)}
                        className="flex items-center justify-between gap-3 py-2 text-left border-b border-secondary/10 last:border-0 cursor-pointer hover:text-surface-accent transition-colors"
                      >
                        <span className="text-small text-surface truncate">{f.guestName}</span>
                        <span className="text-tiny text-surface-muted shrink-0">View folio →</span>
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </Section>

          <Section label="Unresolved No-Shows">
            <p className="text-small text-surface-muted">
              Confirmed arrivals whose date has passed without a check-in. Running the audit marks these as no-shows and applies the
              branch&apos;s no-show penalty policy.
            </p>
            {preflight.unresolvedNoShows.length === 0 ? (
              <p className="text-body text-surface-muted">Nothing unresolved — every arrival is accounted for.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-primary/25">
                      <th className="text-small font-bold text-surface pb-2 pr-4">Guest Name</th>
                      <th className="text-small font-bold text-surface pb-2 pr-4">Confirmation #</th>
                      <th className="text-small font-bold text-surface pb-2 pr-4">Expected Arrival</th>
                      <th className="text-small font-bold text-surface pb-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preflight.unresolvedNoShows.map((r) => (
                      <tr key={r.id} className="border-b border-primary/15 last:border-0">
                        <td className="text-small text-surface py-3 pr-4">{r.guestName}</td>
                        <td className="text-small text-surface py-3 pr-4">{r.confirmationNumber}</td>
                        <td className="text-small text-surface py-3 pr-4">{formatDateOnly(r.checkInDate)}</td>
                        <td className="py-3 text-right">
                          <Button size="sm" variant="outline" onClick={() => router.push(`/dashboard/check-in/${r.id}`)}>
                            View Reservation
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <div className="flex flex-col items-center gap-2">
            {preflight.lastStoppedRun ? (
              <p className="text-small text-red-600 text-center max-w-xl" role="alert" id="night-audit-stopped">
                The last run for {preflight.lastStoppedRun.auditDate} stopped part-way
                {preflight.lastStoppedRun.chargesPosted > 0
                  ? ` after posting ${preflight.lastStoppedRun.chargesPosted} room ${preflight.lastStoppedRun.chargesPosted === 1 ? 'charge' : 'charges'}`
                  : ''}
                {preflight.lastStoppedRun.reason ? ` — ${preflight.lastStoppedRun.reason}` : ''}. Close it again: it carries on where it stopped, and nothing
                already posted is charged twice.
              </p>
            ) : null}
            {preflight.closedAhead.length > 0 ? (
              <p className="text-small text-red-600 text-center max-w-xl" role="alert">
                Out of order: {listDates(preflight.closedAhead)} {preflight.closedAhead.length === 1 ? 'was' : 'were'} closed before{' '}
                {preflight.pendingDates.length === 1 ? 'the earlier night' : 'these earlier nights'} — check the room charges those runs posted once the
                {preflight.pendingDates.length === 1 ? ' night below is' : ' nights below are'} closed.
              </p>
            ) : null}
            <Button type="button" onClick={() => setConfirmOpen(true)} disabled={preflight.alreadyRan} loading={runMutation.isPending}>
              {preflight.alreadyRan ? 'Trigger Audit' : `Close ${preflight.auditDate}`}
            </Button>
            <p className="text-small text-surface-muted text-center">
              {preflight.alreadyRan
                ? `${preflight.auditDate} has already been audited for this property.`
                : preflight.pendingDates.length > 1
                  ? `${preflight.pendingDates.length} nights still to close, oldest first: ${listDates(preflight.pendingDates)}. Each run closes one.`
                  : `Will close ${preflight.auditDate}.`}
            </p>
          </div>
        </>
      )}

      <Section label="Recent Runs">
        {runsQuery.data && runsQuery.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-primary/25">
                  <th className="text-small font-bold text-surface pb-2 pr-4">Audit Date</th>
                  <th className="text-small font-bold text-surface pb-2 pr-4">Status</th>
                  <th className="text-small font-bold text-surface pb-2 pr-4">Trigger</th>
                  <th className="text-small font-bold text-surface pb-2 pr-4 text-right">Folios</th>
                  <th className="text-small font-bold text-surface pb-2 pr-4 text-right">Charges</th>
                  <th className="text-small font-bold text-surface pb-2 text-right">Posted</th>
                </tr>
              </thead>
              <tbody>
                {runsQuery.data.map((run) => (
                  <tr key={run.id} className="border-b border-primary/15 last:border-0">
                    <td className="text-small text-surface py-3 pr-4">{formatDateOnly(run.auditDate)}</td>
                    <td className="py-3 pr-4">
                      <RunStatusBadge status={run.status} />
                    </td>
                    <td className="text-small text-surface-muted py-3 pr-4">{run.triggeredBy ? 'Manual' : 'Scheduled'}</td>
                    <td className="text-small text-surface py-3 pr-4 text-right">{run.foliosProcessed ?? '—'}</td>
                    <td className="text-small text-surface py-3 pr-4 text-right">{run.chargesPosted ?? '—'}</td>
                    <td className="text-small text-surface py-3 text-right">
                      {run.totalAmountPosted ? formatMoney(run.totalAmountPosted, currencySymbolFor(run.currency)) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-body text-surface-muted">No audits have run for this property yet.</p>
        )}
      </Section>

      <ConfirmDialog
        open={confirmOpen}
        title="Run the night audit?"
        description={`This closes ${preflight?.auditDate ?? 'the pending date'}: it posts a room charge for every guest in-house that night and marks unarrived confirmed reservations as no-shows. Once a night is closed it can't be run again, and what it posts can't be undone.${
          preflight && preflight.pendingDates.length > 1 ? ` ${preflight.pendingDates.length - 1} more ${preflight.pendingDates.length === 2 ? 'night' : 'nights'} will still be open after this one.` : ''
        }`}
        confirmLabel={preflight?.alreadyRan ? 'Trigger Audit' : `Close ${preflight?.auditDate ?? 'this night'}`}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleRun}
        loading={runMutation.isPending}
      />
    </Container>
  );
}

/** "2026-10-06, 2026-10-07 and 2026-10-08" — the dates as the audit names them, not re-read in the browser's timezone. */
function listDates(dates: string[]): string {
  if (dates.length <= 1) return dates.join('');
  return `${dates.slice(0, -1).join(', ')} and ${dates[dates.length - 1]}`;
}

/** A `null` result is a check the backend couldn't answer — shown as untracked rather than a tick it hasn't earned. Every check answers today. */
function ChecklistRow({ item }: { item: PreflightCheck }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className={`text-small ${item.passed === null ? 'text-surface-muted' : 'text-surface'}`}>{item.label}</p>
        {/* `text-secondary/60`, not the bare `secondary-light` token — that
            pale lavender-gray read as too washed out for a detail line
            people actually need to read (a real in-house count, a real
            count of urgent work orders), not decorative filler. A partial
            opacity of the dark `secondary` color gives a touch more visual
            weight while staying clearly secondary/muted — same mechanism
            `WizardShell.tsx`'s own `text-surface/70` "active but muted"
            state already uses, just a step lighter since this is a
            passive caption, not something the user is actively on. */}
        {item.detail ? <p className="text-tiny text-surface/60">{item.detail}</p> : null}
      </div>
      <span className="shrink-0 pt-0.5">
        {item.passed === true ? (
          <CheckIcon className="size-4 text-green-700" />
        ) : item.passed === false ? (
          <XIcon className="size-4 text-red-600" />
        ) : (
          <span className="text-tiny text-surface-muted">Not tracked</span>
        )}
      </span>
    </div>
  );
}

function RunStatusBadge({ status }: { status: 'running' | 'completed' | 'failed' }) {
  const styles = {
    completed: 'bg-status-inspected',
    running: 'bg-status-cleaning',
    failed: 'bg-status-out-of-order',
  } as const;
  return <span className={`inline-flex rounded-pill px-3 py-1 text-tiny font-semibold text-white ${styles[status]}`}>{status}</span>;
}
