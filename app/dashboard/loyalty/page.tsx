'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PageHeader } from '@/components/ui/PageHeader';
import { Table, type TableColumn } from '@/components/ui/Table';
import { EmailCampaignIcon } from '@/components/ui/Icons';
import { ApiError } from '@/lib/api';
import {
  BENEFIT_LABELS,
  LOYALTY_BENEFITS,
  useLoyaltyProgramQuery,
  useLoyaltySummaryQuery,
  useSaveLoyaltyProgramMutation,
  type LoyaltyMember,
  type LoyaltyProgram,
} from '@/lib/loyalty';
import { useAuthStore } from '@/lib/store/authStore';
import { HubCard } from '../_components/HubCard';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

/**
 * Loyalty & Marketing (ref p21). The programme is real: guests earn points
 * on a stay's spend before tax when they check out, move up tiers on their
 * lifetime points, and redeem points against a bill. Email Campaign Builder
 * links to its own pages under /dashboard/loyalty/campaigns.
 */
export default function LoyaltyMarketingPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader title="Loyalty & Marketing" subtitle="Points, tiers, campaigns, promo codes, push notifications." roles="Marketing · Manager" />
      <ProgramSection auth={auth} />
      <MembersSection auth={auth} />
      <Section label="Email Campaign Builder">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <HubCard
            icon={<EmailCampaignIcon className="size-5" />}
            title="Email Campaign Builder"
            description="Template, segment, schedule, A/B test"
            href="/dashboard/loyalty/campaigns"
          />
        </div>
      </Section>
    </Container>
  );
}

function ProgramSection({ auth }: { auth: AuthOpts }) {
  const programQuery = useLoyaltyProgramQuery(auth);
  return (
    <Section label="Loyalty Program Config">
      {programQuery.isError ? (
        <p className="text-small text-red-600">{programQuery.error instanceof ApiError ? programQuery.error.message : 'Couldn’t load the programme.'}</p>
      ) : programQuery.data ? (
        <ProgramForm key={programQuery.data.updatedAt ?? 'suggested'} program={programQuery.data} auth={auth} />
      ) : (
        <p className="text-body text-primary-dark/70">Loading…</p>
      )}
    </Section>
  );
}

type TierDraft = { name: string; threshold: string; benefits: string[] };

/** A per-100 rate reads naturally ("1 point for every ₦100"); the API takes the rate per 1 unit. */
function perHundred(pointsPerUnit: string): string {
  return String(Math.round(Number(pointsPerUnit) * 100 * 10000) / 10000);
}

function ProgramForm({ program, auth }: { program: LoyaltyProgram; auth: AuthOpts }) {
  const mutation = useSaveLoyaltyProgramMutation(auth);
  const [isActive, setIsActive] = useState(program.isActive);
  const [currency, setCurrency] = useState<string | null>(program.currency);
  const [pointsPer100, setPointsPer100] = useState(perHundred(program.pointsPerUnit));
  const [pointValue, setPointValue] = useState(String(Number(program.pointValue)));
  const [tiers, setTiers] = useState<TierDraft[]>(program.tiers.map((t) => ({ name: t.name, threshold: String(t.threshold), benefits: t.benefits })));
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const setTier = (index: number, patch: Partial<TierDraft>) => setTiers((current) => current.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)));
  const toggleBenefit = (index: number, benefit: string) =>
    setTier(index, { benefits: tiers[index]?.benefits.includes(benefit) ? tiers[index].benefits.filter((b) => b !== benefit) : [...(tiers[index]?.benefits ?? []), benefit] });

  const back = Number(pointsPer100) * Number(pointValue);

  async function save() {
    setMessage(null);
    const rate = Math.round((Number(pointsPer100) / 100) * 10000) / 10000;
    if (!currency || !Number.isFinite(rate) || rate <= 0 || !(Number(pointValue) > 0)) {
      setMessage({ kind: 'error', text: 'Give an earning rate of at least 0.01 points per 100 and a point value above zero.' });
      return;
    }
    if (tiers.some((t) => !t.name.trim() || t.threshold === '' || !Number.isInteger(Number(t.threshold)) || Number(t.threshold) < 0)) {
      setMessage({ kind: 'error', text: 'Every tier needs a name and a whole number of points to reach it.' });
      return;
    }
    try {
      await mutation.mutateAsync({
        isActive,
        currency,
        pointsPerUnit: rate,
        pointValue: Number(pointValue),
        tiers: tiers.map((t) => ({ name: t.name.trim(), threshold: Number(t.threshold), benefits: t.benefits })),
      });
      setMessage({ kind: 'ok', text: 'Saved. Every member’s tier now follows these thresholds.' });
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.' });
    }
  }

  return (
    <Card tone="accent" className="flex flex-col gap-4">
      {!program.configured ? (
        <p className="text-small text-primary-dark">Not set up yet — these are suggested figures. Nothing is earned until you save and switch the programme on.</p>
      ) : null}
      <label className="flex items-center gap-2 text-body font-semibold text-secondary cursor-pointer">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="size-4 accent-secondary" />
        Programme on — guests earn at check-out and can redeem on their bill
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-2 max-w-3xl">
        <Select
          id="loyalty-currency"
          label="Currency"
          options={program.branchCurrencies.map((c) => ({ value: c, label: c }))}
          value={currency}
          onChange={setCurrency}
          hint="Points are earned and redeemed at branches that charge in this currency."
        />
        <Input
          id="loyalty-points-per-100"
          label={`Points per ${currency ?? ''} 100 spent`}
          type="number"
          min={0.01}
          step="0.01"
          value={pointsPer100}
          onChange={(e) => setPointsPer100(e.target.value)}
          hint="On a stay's spend before tax, rounded down."
        />
        <Input
          id="loyalty-point-value"
          label={`One point is worth (${currency ?? ''})`}
          type="number"
          min={0.0001}
          step="0.01"
          value={pointValue}
          onChange={(e) => setPointValue(e.target.value)}
          hint="Off a bill, when redeemed."
        />
      </div>
      {Number.isFinite(back) && back > 0 ? (
        <p className="text-small text-secondary-light">
          A guest gets back about {currency} {back.toFixed(2)} for every {currency} 100 they spend ({back.toFixed(2)}%).
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-small font-semibold text-secondary">Tiers</p>
          <Button type="button" size="sm" variant="outline" onClick={() => setTiers((current) => [...current, { name: '', threshold: '', benefits: [] }])} disabled={tiers.length >= 10}>
            Add a Tier
          </Button>
        </div>
        <p className="text-tiny text-secondary-light">A member holds the highest tier their lifetime points reach. Spending points never costs them a tier.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {tiers.map((tier, index) => (
            <Card key={index} tone="secondary" className="flex flex-col gap-2">
              <div className="grid grid-cols-[1fr_8rem] gap-3">
                <Input id={`loyalty-tier-${index}-name`} label="Tier" value={tier.name} onChange={(e) => setTier(index, { name: e.target.value })} maxLength={30} placeholder="Gold" />
                <Input id={`loyalty-tier-${index}-threshold`} label="From (points)" type="number" min={0} value={tier.threshold} onChange={(e) => setTier(index, { threshold: e.target.value })} />
              </div>
              <fieldset className="flex flex-wrap gap-x-4 gap-y-1">
                <legend className="text-tiny font-semibold text-secondary">Benefits</legend>
                {LOYALTY_BENEFITS.map((benefit) => (
                  <label key={benefit} className="flex items-center gap-1.5 text-small text-secondary cursor-pointer">
                    <input type="checkbox" checked={tier.benefits.includes(benefit)} onChange={() => toggleBenefit(index, benefit)} className="size-4 accent-secondary" />
                    {BENEFIT_LABELS[benefit]}
                  </label>
                ))}
              </fieldset>
              <Button type="button" size="sm" variant="outline" className="self-start" onClick={() => setTiers((current) => current.filter((_, i) => i !== index))}>
                Remove Tier
              </Button>
            </Card>
          ))}
        </div>
      </div>

      {message ? <p className={`text-small ${message.kind === 'error' ? 'text-red-600' : 'text-green-700'}`}>{message.text}</p> : null}
      <div>
        <Button type="button" onClick={save} loading={mutation.isPending}>
          Save Programme
        </Button>
      </div>
    </Card>
  );
}

function MembersSection({ auth }: { auth: AuthOpts }) {
  const router = useRouter();
  const summaryQuery = useLoyaltySummaryQuery(auth);
  const summary = summaryQuery.data;

  const columns: TableColumn<LoyaltyMember>[] = [
    { key: 'name', label: 'Guest', render: (m) => m.name, sortValue: (m) => m.name },
    { key: 'email', label: 'Email', render: (m) => m.email ?? '—' },
    { key: 'tier', label: 'Tier', render: (m) => m.loyaltyTier, sortValue: (m) => m.loyaltyTier },
    { key: 'points', label: 'Points', align: 'right', render: (m) => m.loyaltyPoints.toLocaleString(), sortValue: (m) => m.loyaltyPoints },
    {
      key: 'action',
      label: 'Action',
      align: 'right',
      render: (m) => (
        <Button size="sm" variant="outline" onClick={() => router.push(`/dashboard/guests/${m.id}`)}>
          View Profile
        </Button>
      ),
    },
  ];

  return (
    <Section label="Loyalty Members">
      {summaryQuery.isLoading || !summary ? (
        <p className="text-body text-primary-dark/70">Loading…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-4">
            <Card tone="accent" className="flex-1 min-w-40">
              <p className="text-tiny text-primary-dark/70">Total Members</p>
              <p className="text-header font-bold text-primary-dark">{summary.totalMembers}</p>
            </Card>
            <Card tone="accent" className="flex-1 min-w-40">
              <p className="text-tiny text-primary-dark/70">Points Outstanding</p>
              <p className="text-header font-bold text-primary-dark">{summary.totalPointsIssued.toLocaleString()}</p>
            </Card>
            {summary.byTier.map((t) => (
              <Card key={t.tier} tone="accent" className="flex-1 min-w-40">
                <p className="text-tiny text-primary-dark/70">{t.tier}</p>
                <p className="text-header font-bold text-primary-dark">{t.memberCount}</p>
                <p className="text-tiny text-primary-dark/60">{t.totalPoints.toLocaleString()} pts</p>
              </Card>
            ))}
          </div>

          {summary.members.length === 0 ? (
            <p className="text-body text-primary-dark/70">No members yet — guests join when they check out while the programme is on, or from their profile.</p>
          ) : (
            <Card tone="secondary">
              <Table columns={columns} rows={summary.members} emptyMessage="No loyalty members yet." exportFileName="loyalty-members" />
            </Card>
          )}
        </div>
      )}
    </Section>
  );
}
