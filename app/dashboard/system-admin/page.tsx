'use client';

import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { FeatureFlagsIcon, BackupManagementIcon, SystemHealthIcon } from '@/components/ui/Icons';
import { HubCard } from '../_components/HubCard';

/**
 * System Admin (ref p24) — feature flags, environment config, backups,
 * deployment controls, monitoring. No backup/system-health admin screen
 * exists yet, confirmed directly rather than assumed.
 */
export default function SystemAdminPage() {
  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader title="System Admin" subtitle="Feature flags, environment config, backups, deployment controls, monitoring." roles="SysAdmin" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <HubCard icon={<FeatureFlagsIcon className="size-5" />} title="Feature Flags" description="Enable/disable features per tenant or user" />
        <HubCard icon={<BackupManagementIcon className="size-5" />} title="Backup Management" description="Scheduled backups, restore, retention" />
        <HubCard icon={<SystemHealthIcon className="size-5" />} title="System Health Monitor" description="CPU, DB, API response times, error rates" />
      </div>
    </Container>
  );
}
