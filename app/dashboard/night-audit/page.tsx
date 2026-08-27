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
    setConfirmOpen(false);
    try {
      setLastRun(await runMutation.mutateAsync(undefined));
    } catch (error) {
      setRunError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  }

  if (!activeBranchId) return null;

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader icon={<ReceiptIcon className="size-8" />} title="Night Audit" subtitle="End-of-day rollover and reconciliation" />

      {runError ? <p className="text-small text-red-600">{runError}</p> : null}
      {lastRun ? (
        <Card tone="secondary">
          <p className="text-small text-secondary">
            <span className="font-bold">Audit {lastRun.status} for {lastRun.auditDate}.</span>{' '}
            {lastRun.chargesPosted} room {lastRun.chargesPosted === 1 ? 'charge' : 'charges'} posted across {lastRun.foliosProcessed}{' '}
            {lastRun.foliosProcessed === 1 ? 'folio' : 'folios'}
            {lastRun.noShowsMarked > 0 ? `, ${lastRun.noShowsMarked} no-show${lastRun.noShowsMarked === 1 ? '' : 's'} marked` : ''}.
            {lastRun.errors.length > 0 ? ` ${lastRun.errors.length} reservation(s) errored and were skipped.` : ''}
          </p>
        </Card>
      ) : null}

      {preflightQuery.isLoading ? (
        <p className="text-body text-secondary-light">Loading pre-audit checks…</p>
      ) : preflightQuery.isError || !preflight ? (
        <p className="text-body text-red-600">Could not load pre-audit information.</p>
      ) : (
        <>
          <Section label="Pre-Audit Info">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <Card tone="secondary" className="flex flex-col gap-3">
                <div>
                  <h3 className="text-body font-bold text-secondary">Pre-audit Checklist</h3>
                  <p className="text-small text-secondary-light">Conditions that should be met before the night audit runs</p>
                </div>
                <div className="flex flex-col gap-2 pt-2 border-t border-secondary/20">
                  {preflight.checklist.map((item) => (
                    <ChecklistRow key={item.key} item={item} />
                  ))}
                </div>
              </Card>

              <Card tone="secondary" className="flex flex-col gap-3">
                <div>
                  <h3 className="text-body font-bold text-secondary">Open Folios</h3>
                  <p className="text-small text-secondary-light">Folios still in open status ({preflight.openFolios.length})</p>
                </div>
                {preflight.openFolios.length === 0 ? (
                  <p className="text-small text-secondary-light pt-2 border-t border-secondary/20">No open folios.</p>
                ) : (
                  <div className="flex flex-col pt-2 border-t border-secondary/20 max-h-64 overflow-y-auto">
                    {preflight.openFolios.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => router.push(`/dashboard/billing/${f.id}`)}
                        className="flex items-center justify-between gap-3 py-2 text-left border-b border-secondary/10 last:border-0 cursor-pointer hover:text-primary-text transition-colors"
                      >
                        <span className="text-small text-secondary truncate">{f.guestName}</span>
                        <span className="text-tiny text-secondary-light shrink-0">View folio →</span>
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </Section>

          <Section label="Unresolved No-Shows">
            <p className="text-small text-secondary-light">
              Confirmed arrivals whose date has passed without a check-in. Running the audit marks these as no-shows and applies the
              branch&apos;s no-show penalty policy.
            </p>
            {preflight.unresolvedNoShows.length === 0 ? (
              <p className="text-body text-secondary-light">Nothing unresolved — every arrival is accounted for.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-secondary/20">
                      <th className="text-small font-bold text-secondary pb-2 pr-4">Guest Name</th>
                      <th className="text-small font-bold text-secondary pb-2 pr-4">Confirmation #</th>
                      <th className="text-small font-bold text-secondary pb-2 pr-4">Expected Arrival</th>
                      <th className="text-small font-bold text-secondary pb-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preflight.unresolvedNoShows.map((r) => (
                      <tr key={r.id} className="border-b border-secondary/10 last:border-0">
                        <td className="text-small text-secondary py-3 pr-4">{r.guestName}</td>
                        <td className="text-small text-secondary py-3 pr-4">{r.confirmationNumber}</td>
                        <td className="text-small text-secondary py-3 pr-4">{new Date(r.checkInDate).toLocaleDateString()}</td>
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
            <Button type="button" onClick={() => setConfirmOpen(true)} disabled={preflight.alreadyRan} loading={runMutation.isPending}>
              Trigger Audit
            </Button>
            <p className="text-small text-secondary-light">
              {preflight.alreadyRan
                ? `${preflight.auditDate} has already been audited for this property.`
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
                <tr className="border-b border-secondary/20">
                  <th className="text-small font-bold text-secondary pb-2 pr-4">Audit Date</th>
                  <th className="text-small font-bold text-secondary pb-2 pr-4">Status</th>
                  <th className="text-small font-bold text-secondary pb-2 pr-4">Trigger</th>
                  <th className="text-small font-bold text-secondary pb-2 pr-4 text-right">Folios</th>
                  <th className="text-small font-bold text-secondary pb-2 pr-4 text-right">Charges</th>
                  <th className="text-small font-bold text-secondary pb-2 text-right">Posted</th>
                </tr>
              </thead>
              <tbody>
                {runsQuery.data.map((run) => (
                  <tr key={run.id} className="border-b border-secondary/10 last:border-0">
                    <td className="text-small text-secondary py-3 pr-4">{new Date(run.auditDate).toLocaleDateString()}</td>
                    <td className="py-3 pr-4">
                      <RunStatusBadge status={run.status} />
                    </td>
                    <td className="text-small text-secondary-light py-3 pr-4">{run.triggeredBy ? 'Manual' : 'Scheduled'}</td>
                    <td className="text-small text-secondary py-3 pr-4 text-right">{run.foliosProcessed ?? '—'}</td>
                    <td className="text-small text-secondary py-3 pr-4 text-right">{run.chargesPosted ?? '—'}</td>
                    <td className="text-small text-secondary py-3 text-right">
                      {run.totalAmountPosted ? formatMoney(run.totalAmountPosted, currencySymbolFor(run.currency)) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-body text-secondary-light">No audits have run for this property yet.</p>
        )}
      </Section>

      <ConfirmDialog
        open={confirmOpen}
        title="Run the night audit?"
        description={`This closes ${preflight?.auditDate ?? 'the pending date'}: it posts a room charge for every guest in-house that night and marks unarrived confirmed reservations as no-shows. It can only be run once per date and cannot be undone.`}
        confirmLabel="Trigger Audit"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleRun}
      />
    </Container>
  );
}

/** A `null` result means the check's module isn't built — shown as untracked rather than a tick it hasn't earned. */
function ChecklistRow({ item }: { item: PreflightCheck }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className={`text-small ${item.passed === null ? 'text-secondary-light' : 'text-secondary'}`}>{item.label}</p>
        {item.detail ? <p className="text-tiny text-secondary-light">{item.detail}</p> : null}
      </div>
      <span className="shrink-0 pt-0.5">
        {item.passed === true ? (
          <CheckIcon className="size-4 text-green-700" />
        ) : item.passed === false ? (
          <XIcon className="size-4 text-red-600" />
        ) : (
          <span className="text-tiny text-secondary-light">Not tracked</span>
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
