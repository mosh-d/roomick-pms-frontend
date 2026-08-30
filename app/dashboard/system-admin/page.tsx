'use client';

import { useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { FeatureFlagsIcon } from '@/components/ui/Icons';
import {
  useFeatureFlagsQuery,
  useToggleFeatureFlagMutation,
  useBackupsQuery,
  useTriggerBackupMutation,
  useVerifyBackupMutation,
  useRestoreDrillMutation,
  useDetailedHealthQuery,
  type BackupRecordSummary,
  type VerifyBackupResult,
  type RestoreDrillResult,
} from '@/lib/systemAdmin';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';

function formatBytes(sizeBytes: string | null): string {
  if (sizeBytes === null) return '—';
  const bytes = Number(sizeBytes);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_TONE: Record<string, string> = {
  completed: 'bg-green-50 text-green-700',
  running: 'bg-amber-100 text-amber-800',
  failed: 'bg-red-100 text-red-700',
};

/**
 * System Admin (ref p24) — feature flags, environment config, backups,
 * deployment controls, monitoring. Built tenant-scoped, not as a
 * cross-tenant platform-admin console: this app's entire auth model
 * (`TenantGuard`, every `@Roles()` guard) is single-tenant, with no
 * "SysAdmin" concept anywhere — introducing real cross-tenant admin auth
 * was explicitly out of scope for this pass. Concretely: Feature Flags
 * lets an Owner opt THEIR OWN tenant into an existing flag (never create
 * one, never see who else has it on); Backup Management is this tenant's
 * own backup history and actions; System Health is a shared read of the
 * one running process everyone's on, not per-tenant data.
 */
export default function SystemAdminPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader
        icon={<FeatureFlagsIcon className="size-8" />}
        title="System Admin"
        subtitle="Feature flags, environment config, backups, deployment controls, monitoring."
        roles="SysAdmin"
      />

      <FeatureFlagsSection auth={auth} />
      <BackupManagementSection auth={auth} />
      <SystemHealthSection auth={auth} />
    </Container>
  );
}

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

function FeatureFlagsSection({ auth }: { auth: AuthOpts }) {
  const flagsQuery = useFeatureFlagsQuery(auth);
  const toggleMutation = useToggleFeatureFlagMutation(auth);

  return (
    <Section label="Feature Flags">
      <p className="text-small text-primary-dark/70">
        Enable or disable a flag for this tenant only — global rollout and every other tenant&rsquo;s membership stay platform-controlled. No flag
        currently gates any real behavior in the app yet; toggling one records the choice but has no visible effect until a feature is built behind it.
      </p>
      {flagsQuery.isLoading ? (
        <p className="text-body text-primary-dark/70">Loading…</p>
      ) : (flagsQuery.data ?? []).length === 0 ? (
        <p className="text-body text-primary-dark/70">No feature flags exist yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {(flagsQuery.data ?? []).map((flag) => (
            <Card key={flag.id} tone="accent" className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-body font-semibold text-primary-dark">{flag.name}</p>
                <p className="text-tiny text-primary-dark/60">
                  {flag.enabledForThisTenant ? 'On for this tenant' : 'Off for this tenant'}
                  {flag.rolloutPct !== null ? ` · ${flag.rolloutPct}% global rollout` : ''}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                loading={toggleMutation.isPending && toggleMutation.variables?.flagId === flag.id}
                onClick={() => toggleMutation.mutate({ flagId: flag.id, enabled: !flag.enabledForThisTenant })}
              >
                {flag.enabledForThisTenant ? 'On for us — Disable' : 'Off for us — Enable'}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </Section>
  );
}

function BackupManagementSection({ auth }: { auth: AuthOpts }) {
  const backupsQuery = useBackupsQuery(auth);
  const triggerMutation = useTriggerBackupMutation(auth);
  const [error, setError] = useState<string | null>(null);

  async function runBackup() {
    setError(null);
    try {
      await triggerMutation.mutateAsync();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <Section label="Backup Management">
      <div className="flex items-center justify-between gap-4">
        <p className="text-small text-primary-dark/70">A full snapshot of this tenant&rsquo;s own data also runs automatically every night at 2 AM.</p>
        <Button type="button" variant="outline" loading={triggerMutation.isPending} onClick={runBackup}>
          Run Backup Now
        </Button>
      </div>
      {error ? <p className="text-small text-red-600">{error}</p> : null}
      {triggerMutation.isSuccess ? <p className="text-small text-green-700">Backup {triggerMutation.data.status}.</p> : null}

      {backupsQuery.isLoading ? (
        <p className="text-body text-primary-dark/70">Loading…</p>
      ) : (backupsQuery.data ?? []).length === 0 ? (
        <p className="text-body text-primary-dark/70">No backups recorded yet for this tenant.</p>
      ) : (
        <Card tone="secondary" className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-small font-bold text-secondary text-left">
                <th className="py-2 pr-4">Started</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Size</th>
                <th className="py-2 pr-4">Retain Until</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(backupsQuery.data ?? []).map((record) => (
                <BackupRow key={record.id} record={record} auth={auth} />
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </Section>
  );
}

function BackupRow({ record, auth }: { record: BackupRecordSummary; auth: AuthOpts }) {
  const verifyMutation = useVerifyBackupMutation(auth);
  const restoreDrillMutation = useRestoreDrillMutation(auth);
  const [verifyResult, setVerifyResult] = useState<VerifyBackupResult | null>(null);
  const [drillResult, setDrillResult] = useState<RestoreDrillResult | null>(null);

  async function verify() {
    setVerifyResult(null);
    const result = await verifyMutation.mutateAsync(record.id);
    setVerifyResult(result);
  }

  async function restoreDrill() {
    setDrillResult(null);
    const result = await restoreDrillMutation.mutateAsync(record.id);
    setDrillResult(result);
  }

  return (
    <tr className="border-t border-secondary/10 text-small text-secondary align-top">
      <td className="py-2 pr-4">{new Date(record.startedAt).toLocaleString()}</td>
      <td className="py-2 pr-4">
        <span className={`inline-flex items-center rounded-pill px-2 py-0.5 text-tiny font-semibold ${STATUS_TONE[record.status] ?? 'bg-secondary-light/20 text-secondary'}`}>{record.status}</span>
      </td>
      <td className="py-2 pr-4">{formatBytes(record.sizeBytes)}</td>
      <td className="py-2 pr-4">{record.retainUntil ? new Date(record.retainUntil).toLocaleDateString() : '—'}</td>
      <td className="py-2 pr-4">
        {record.status !== 'completed' ? (
          '—'
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" loading={verifyMutation.isPending} onClick={verify}>
                Verify
              </Button>
              <Button size="sm" variant="outline" loading={restoreDrillMutation.isPending} onClick={restoreDrill}>
                Restore Drill
              </Button>
            </div>
            {verifyResult ? (
              <p className={`text-tiny ${verifyResult.ok ? 'text-green-700' : 'text-red-600'}`}>
                {verifyResult.ok ? `Verified — ${Object.keys(verifyResult.modelCounts ?? {}).length} tables intact.` : `Verify failed: ${verifyResult.error}`}
              </p>
            ) : null}
            {drillResult ? (
              <p className={`text-tiny ${drillResult.ok ? 'text-green-700' : 'text-red-600'}`}>
                {drillResult.ok ? 'Restore drill OK — every row count matched.' : `Restore drill failed: ${drillResult.error ?? drillResult.mismatches?.join(', ')}`}
              </p>
            ) : null}
          </div>
        )}
      </td>
    </tr>
  );
}

function SystemHealthSection({ auth }: { auth: AuthOpts }) {
  const healthQuery = useDetailedHealthQuery(auth);
  const health = healthQuery.data;

  return (
    <Section label="System Health Monitor">
      <p className="text-small text-primary-dark/70">
        CPU utilization isn&rsquo;t shown — it only means anything as a delta over a measured interval, and there&rsquo;s no such sampling
        infrastructure in this app yet. Request metrics are a 15-minute in-memory rolling window; they reset on every server restart.
      </p>
      {healthQuery.isLoading || !health ? (
        <p className="text-body text-primary-dark/70">Loading…</p>
      ) : (
        <div className="flex flex-wrap gap-4">
          <Card tone="accent" className="flex-1 min-w-40">
            <p className="text-tiny text-primary-dark/70">Status</p>
            <p className={`text-header font-bold ${health.status === 'ok' ? 'text-green-700' : 'text-red-600'}`}>{health.status === 'ok' ? 'OK' : 'Degraded'}</p>
          </Card>
          <Card tone="accent" className="flex-1 min-w-40">
            <p className="text-tiny text-primary-dark/70">Database</p>
            <p className="text-header font-bold text-primary-dark">{health.checks.database === 'up' ? `${health.checks.databaseLatencyMs}ms` : 'Down'}</p>
          </Card>
          <Card tone="accent" className="flex-1 min-w-40">
            <p className="text-tiny text-primary-dark/70">Uptime</p>
            <p className="text-header font-bold text-primary-dark">{Math.floor(health.process.uptimeSeconds / 60)}m</p>
          </Card>
          <Card tone="accent" className="flex-1 min-w-40">
            <p className="text-tiny text-primary-dark/70">Memory (heap)</p>
            <p className="text-header font-bold text-primary-dark">
              {health.process.memory.heapUsedMb} / {health.process.memory.heapTotalMb} MB
            </p>
          </Card>
          <Card tone="accent" className="flex-1 min-w-40">
            <p className="text-tiny text-primary-dark/70">Requests (last {health.requestMetrics.windowMinutes}m)</p>
            <p className="text-header font-bold text-primary-dark">{health.requestMetrics.requestCount}</p>
          </Card>
          <Card tone="accent" className="flex-1 min-w-40">
            <p className="text-tiny text-primary-dark/70">Avg Response Time</p>
            <p className="text-header font-bold text-primary-dark">{health.requestMetrics.avgResponseTimeMs !== null ? `${health.requestMetrics.avgResponseTimeMs}ms` : '—'}</p>
          </Card>
          <Card tone="accent" className="flex-1 min-w-40">
            <p className="text-tiny text-primary-dark/70">Error Rate</p>
            <p className="text-header font-bold text-primary-dark">{health.requestMetrics.errorRatePct !== null ? `${health.requestMetrics.errorRatePct}%` : '—'}</p>
          </Card>
        </div>
      )}
    </Section>
  );
}
