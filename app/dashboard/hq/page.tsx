'use client';

import { useMemo, useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { PortfolioOverviewIcon } from '@/components/ui/Icons';
import { usePortfolioQuery, useCrossPropertyReportQuery, type CrossPropertyReportType } from '@/lib/hq';
import { useBrandsQuery, useUpdateBrandMutation, useCreateBrandMutation, useCreateBranchMutation, type Brand, type AddressInput } from '@/lib/propertyConfig';
import { COUNTRIES } from '@/lib/countries';
import { timezoneOptionsFor, defaultTimezoneFor } from '@/lib/timezones';
import { isOwner } from '@/lib/roles';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

const REPORT_TABS: Array<{ value: CrossPropertyReportType; label: string }> = [
  { value: 'occupancy', label: 'Occupancy' },
  { value: 'adr', label: 'ADR' },
  { value: 'revpar', label: 'RevPAR' },
  { value: 'revenue', label: 'Revenue' },
];

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 29 * 86400000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

/** The headline figure for a report type's own summary/blendedTotal shape — the one number worth a row-level column, matching each single-branch report page's own summary framing. */
function headlineFor(type: CrossPropertyReportType, summary: Record<string, string | number>): string {
  if (type === 'occupancy') return `${summary.occupancyPct}%`;
  if (type === 'adr') return String(summary.adr);
  if (type === 'revpar') return String(summary.revpar);
  return String(summary.totalRevenue);
}

/**
 * Enterprise / HQ (ref p25) — one page, four `Section`s, matching every
 * other Management/Admin item's own established shape. Entirely Owner-only
 * (every `/hq/*` route and brand/branch-creation route already is) — gated
 * once at the page level rather than per-section, since there's no partial
 * view here the way Property Config has (Manager can see Branch Details
 * there even though Brand editing is Owner-only).
 */
export default function EnterpriseHqPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader
        icon={<PortfolioOverviewIcon className="size-8" />}
        title="Enterprise / HQ View"
        subtitle="Multi-brand overview, cross-property reporting, centralized brand management."
        roles="Owner · HQ Admin"
      />

      {!isOwner(user) ? (
        <Card tone="accent">
          <p className="text-body text-primary-dark">Enterprise / HQ is available to the account Owner only.</p>
        </Card>
      ) : (
        <>
          <PortfolioOverviewSection auth={auth} />
          <CrossPropertyReportsSection auth={auth} />
          <BrandManagementSection auth={auth} />
          <AddNewBranchSection auth={auth} />
        </>
      )}
    </Container>
  );
}

function PortfolioOverviewSection({ auth }: { auth: AuthOpts }) {
  const portfolioQuery = usePortfolioQuery(auth);
  const portfolio = portfolioQuery.data;

  return (
    <Section label="Portfolio Overview">
      {portfolioQuery.isLoading || !portfolio ? (
        <p className="text-body text-primary-dark/70">Loading…</p>
      ) : portfolio.branches.length === 0 ? (
        <p className="text-body text-primary-dark/70">No branches yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-4">
            <Card tone="accent" className="flex-1 min-w-40">
              <p className="text-tiny text-primary-dark/70">Brands</p>
              <p className="text-header font-bold text-primary-dark">{portfolio.brandCount}</p>
            </Card>
            <Card tone="accent" className="flex-1 min-w-40">
              <p className="text-tiny text-primary-dark/70">Branches</p>
              <p className="text-header font-bold text-primary-dark">{portfolio.branchCount}</p>
            </Card>
          </div>
          <Card tone="secondary" className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-small font-bold text-secondary text-left">
                  <th className="py-2 pr-4">Branch</th>
                  <th className="py-2 pr-4">Brand</th>
                  <th className="py-2 pr-4">Occupancy Now</th>
                  <th className="py-2 pr-4">In-House</th>
                  <th className="py-2 pr-4">Outstanding Balance</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.branches.map((b) => (
                  <tr key={b.branchId} className="border-t border-secondary/10 text-small text-secondary">
                    <td className="py-2 pr-4">{b.branchName}</td>
                    <td className="py-2 pr-4">{b.brandName}</td>
                    <td className="py-2 pr-4">
                      {b.occupancyPctNow}% ({b.occupiedRooms}/{b.totalRooms})
                    </td>
                    <td className="py-2 pr-4">{b.inHouseReservations}</td>
                    <td className="py-2 pr-4">
                      {b.currency} {b.outstandingBalance}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </Section>
  );
}

function CrossPropertyReportsSection({ auth }: { auth: AuthOpts }) {
  const [type, setType] = useState<CrossPropertyReportType>('occupancy');
  const [{ from, to }, setRange] = useState(defaultRange);
  const reportQuery = useCrossPropertyReportQuery({ type, from, to }, auth);
  const report = reportQuery.data;

  return (
    <Section label="Cross-Property Reports">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="inline-flex rounded-control border border-accent/30 p-1 gap-1">
          {REPORT_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setType(tab.value)}
              className={`rounded-control px-3 py-1.5 text-small font-semibold cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                type === tab.value ? 'bg-primary text-white' : 'text-primary-dark hover:bg-accent/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <div className="w-40">
            <Input id="hq-report-from" name="from" label="From" type="date" value={from} onChange={(e) => setRange({ from: e.target.value, to })} />
          </div>
          <div className="w-40">
            <Input id="hq-report-to" name="to" label="To (exclusive)" type="date" min={from} value={to} onChange={(e) => setRange({ from, to: e.target.value })} />
          </div>
        </div>
      </div>

      {reportQuery.isLoading || !report ? (
        <p className="text-body text-primary-dark/70">Loading…</p>
      ) : report.rows.length === 0 ? (
        <p className="text-body text-primary-dark/70">No branches to report on.</p>
      ) : (
        <div className="flex flex-col gap-2">
          <Card tone="secondary" className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-small font-bold text-secondary text-left">
                  <th className="py-2 pr-4">Branch</th>
                  <th className="py-2 pr-4">Currency</th>
                  <th className="py-2 pr-4">{REPORT_TABS.find((t) => t.value === type)?.label}</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.branchId} className="border-t border-secondary/10 text-small text-secondary">
                    <td className="py-2 pr-4">{r.branchName}</td>
                    <td className="py-2 pr-4">{r.currency}</td>
                    <td className="py-2 pr-4">{headlineFor(type, r.summary)}</td>
                  </tr>
                ))}
                {report.blendedTotal ? (
                  <tr className="border-t border-secondary/20 text-small font-bold text-secondary">
                    <td className="py-2 pr-4">All Branches</td>
                    <td className="py-2 pr-4">{report.rows[0]?.currency}</td>
                    <td className="py-2 pr-4">{headlineFor(type, report.blendedTotal)}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </Card>
          {report.mixedCurrencies && type !== 'occupancy' ? (
            <p className="text-tiny text-primary-dark/60">
              Branches use different currencies — no blended total is shown for {REPORT_TABS.find((t) => t.value === type)?.label} to avoid summing amounts across currencies with no conversion.
            </p>
          ) : null}
        </div>
      )}
    </Section>
  );
}

function BrandManagementSection({ auth }: { auth: AuthOpts }) {
  const brandsQuery = useBrandsQuery(auth);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <Section label="Brand Management">
      {brandsQuery.isLoading ? (
        <p className="text-body text-primary-dark/70">Loading…</p>
      ) : (
        <div className="flex flex-col gap-3">
          {(brandsQuery.data ?? []).map((brand) => (
            <BrandRow key={brand.id} brand={brand} auth={auth} />
          ))}
          <div>
            <Button type="button" variant="outline" onClick={() => setAddOpen(true)}>
              Add Brand
            </Button>
          </div>
        </div>
      )}
      <AddBrandModal open={addOpen} onClose={() => setAddOpen(false)} auth={auth} />
    </Section>
  );
}

function BrandRow({ brand, auth }: { brand: Brand; auth: AuthOpts }) {
  const updateMutation = useUpdateBrandMutation(auth);
  const [name, setName] = useState(brand.name);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    try {
      await updateMutation.mutateAsync({ brandId: brand.id, name });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <Card tone="accent" className="flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-48">
        <Input id={`brand-name-${brand.id}`} label="Brand Name" value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} />
      </div>
      {error ? <p className="text-small text-red-600">{error}</p> : null}
      {saved ? <p className="text-small text-green-700">Saved.</p> : null}
      <Button type="button" variant="outline" onClick={save} disabled={updateMutation.isPending || !name.trim()}>
        {updateMutation.isPending ? 'Saving…' : 'Save'}
      </Button>
    </Card>
  );
}

function AddBrandModal({ open, onClose, auth }: { open: boolean; onClose: () => void; auth: AuthOpts }) {
  const createMutation = useCreateBrandMutation(auth);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    try {
      await createMutation.mutateAsync({ name: name.trim() });
      setName('');
      onClose();
    } catch (err) {
      // Single-mode tenants get a real 409 here — the backend's own "single-mode allows exactly one" rule, surfaced as a normal form error, not hidden.
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Brand">
      <Input id="new-brand-name" label="Brand Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Resorts" />
      {error ? <p className="text-small text-red-600">{error}</p> : null}
      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={submit} loading={createMutation.isPending} disabled={!name.trim()}>
          Add Brand
        </Button>
      </div>
    </Modal>
  );
}

function AddNewBranchSection({ auth }: { auth: AuthOpts }) {
  const brandsQuery = useBrandsQuery(auth);
  const createMutation = useCreateBranchMutation(auth);

  const [brandId, setBrandId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState<string | null>(null);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [currency, setCurrency] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const brandOptions = useMemo(() => (brandsQuery.data ?? []).map((b) => ({ value: b.id, label: b.name })), [brandsQuery.data]);
  const effectiveBrandId = brandId ?? brandOptions[0]?.value ?? null;

  async function submit() {
    if (!effectiveBrandId || !name.trim() || !street.trim() || !city.trim() || !country || !timezone || !currency.trim()) return;
    setError(null);
    setSaved(false);
    try {
      const address: AddressInput = { street: street.trim(), city: city.trim(), country };
      await createMutation.mutateAsync({ brandId: effectiveBrandId, name: name.trim(), address, timezone, currency: currency.toUpperCase() });
      setName('');
      setStreet('');
      setCity('');
      setCountry(null);
      setTimezone(null);
      setCurrency('');
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <Section label="Add New Branch">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 max-w-2xl">
        <Select id="new-branch-brand" label="Brand" options={brandOptions} value={effectiveBrandId} onChange={setBrandId} />
        <Input id="new-branch-name" label="Branch Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Hotel Lagos" />
        <Input id="new-branch-street" label="Street" value={street} onChange={(e) => setStreet(e.target.value)} />
        <Input id="new-branch-city" label="City" value={city} onChange={(e) => setCity(e.target.value)} />
        <Select
          id="new-branch-country"
          label="Country"
          options={COUNTRIES}
          value={country}
          onChange={(v) => {
            setCountry(v);
            setTimezone(defaultTimezoneFor(v));
          }}
        />
        <Select id="new-branch-timezone" label="Timezone" options={timezoneOptionsFor(country)} value={timezone} onChange={setTimezone} />
        <Input id="new-branch-currency" label="Currency (ISO 4217)" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} placeholder="NGN" />
      </div>
      {error ? <p className="text-small text-red-600">{error}</p> : null}
      {saved ? <p className="text-small text-green-700">Branch created.</p> : null}
      <div>
        <Button
          type="button"
          onClick={submit}
          loading={createMutation.isPending}
          disabled={!effectiveBrandId || !name.trim() || !street.trim() || !city.trim() || !country || !timezone || !currency.trim()}
        >
          Add Branch
        </Button>
      </div>
    </Section>
  );
}
