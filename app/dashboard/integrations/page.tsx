'use client';

import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { PaymentGatewayIcon, WebhooksIcon, ApiKeysIcon } from '@/components/ui/Icons';
import { HubCard } from '../_components/HubCard';

/**
 * Integrations & APIs (ref p23) — payment gateways, smart locks, webhooks,
 * partner APIs, OTA integrations. No integrations page exists yet,
 * confirmed directly rather than assumed.
 */
export default function IntegrationsPage() {
  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader title="Integrations & APIs" subtitle="Payment gateways, smart locks, webhooks, partner APIs, OTA integrations." roles="Admin · Developer" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <HubCard icon={<PaymentGatewayIcon className="size-5" />} title="Payment Gateway" description="Stripe / Adyen / Authorize.net config" />
        <HubCard icon={<WebhooksIcon className="size-5" />} title="Webhooks" description="Subscribe external systems to PMS events" />
        <HubCard icon={<ApiKeysIcon className="size-5" />} title="API Keys" description="Generate and manage partner API credentials" />
      </div>
    </Container>
  );
}
