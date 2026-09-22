import { Card } from '@/components/ui/Card';
import { CAMPAIGN_STATUS_LABELS, useDeliveryStatusQuery, type CampaignStatus } from '@/lib/marketing';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

/** Shared by the campaign list and a campaign's own page. */
const STATUS_CLASSES: Record<CampaignStatus, string> = {
  draft: 'bg-secondary/10 text-secondary',
  scheduled: 'bg-blue-100 text-blue-800',
  sending: 'bg-amber-100 text-amber-800',
  sent: 'bg-green-100 text-green-800',
  cancelled: 'bg-secondary/10 text-secondary/60',
  failed: 'bg-red-100 text-red-800',
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-tiny font-semibold ${STATUS_CLASSES[status]}`}>{CAMPAIGN_STATUS_LABELS[status]}</span>;
}

export function formatWhen(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
}

/** Says, before anyone builds a campaign, whether a send will reach real inboxes. */
export function DeliveryNotice({ auth }: { auth: AuthOpts }) {
  const delivery = useDeliveryStatusQuery(auth);
  if (!delivery.data || delivery.data.deliversExternally) return null;
  return (
    <Card tone="accent" className="flex flex-col gap-1">
      <p className="text-small font-semibold text-primary-dark">No email provider is connected yet</p>
      <p className="text-small text-primary-dark/80">
        Campaigns can be built, tested and sent, and every message is recorded against the guest — but it goes to the server log, not to anyone’s inbox,
        until an email provider is connected. Until then no guest receives it, so opens and clicks won’t come in.
      </p>
    </Card>
  );
}
