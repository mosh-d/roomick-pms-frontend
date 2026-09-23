'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { PageHeader } from '@/components/ui/PageHeader';
import { BackButton } from '@/components/ui/BackButton';
import { IntegrationsIcon } from '@/components/ui/Icons';
import { ApiError } from '@/lib/api';
import {
  downloadJournals,
  listingState,
  useDisableConnectionMutation,
  useJournalPreviewMutation,
  useListingQuery,
  useReviewPreviewQuery,
  useSaveConnectionMutation,
  type AccountingConfig,
  type ListingDetail,
  type ReviewRequestConfig,
} from '@/lib/marketplace';
import { useAuthStore } from '@/lib/store/authStore';
import { ListingStateBadge } from '../_components/marketplaceUi';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };
type Message = { kind: 'ok' | 'error'; text: string } | null;

const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

export default function ListingPage() {
  const params = useParams<{ provider: string }>();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const branchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };
  const listing = useListingQuery(params.provider, auth);

  return (
    <Container className="max-w-5xl py-10 flex flex-col gap-8">
      <BackButton fallbackHref="/dashboard/integrations/marketplace" />
      {listing.isError ? (
        <p className="text-small text-red-600">{errorText(listing.error, 'Couldn’t load this integration.')}</p>
      ) : !listing.data ? (
        <p className="text-small text-secondary">Loading…</p>
      ) : (
        // Keyed on the integration only: switching it on refetches the listing,
        // and remounting then would drop the "it's on" confirmation.
        <ListingContent key={listing.data.key} listing={listing.data} auth={auth} branchId={branchId} />
      )}
    </Container>
  );
}

function ListingContent({ listing, auth, branchId }: { listing: ListingDetail; auth: AuthOpts; branchId: string | null }) {
  const state = listingState(listing);
  const disable = useDisableConnectionMutation(listing.key, auth);
  const [message, setMessage] = useState<Message>(null);

  return (
    <>
      <PageHeader icon={<IntegrationsIcon className="size-6" />} title={listing.name} subtitle={`${listing.categoryLabel} · ${listing.vendor}`} />
      <Card className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <ListingStateBadge state={state} />
          {state === 'on' && listing.connection ? (
            <span className="text-small text-secondary">Switched on {new Date(listing.connection.enabledAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          ) : null}
          {state === 'on' ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="ml-auto"
              loading={disable.isPending}
              onClick={() =>
                disable.mutate(undefined, {
                  onSuccess: () => setMessage({ kind: 'ok', text: 'Switched off. The settings are kept for when you switch it back on.' }),
                  onError: (err) => setMessage({ kind: 'error', text: errorText(err, 'Couldn’t switch it off.') }),
                })
              }
            >
              Switch Off
            </Button>
          ) : null}
        </div>
        <p className="text-body text-secondary">{listing.summary}</p>
        <p className="text-small text-secondary/80">{listing.howItWorks}</p>
        {state === 'coming_later' && listing.waitingOn ? (
          <p className="text-small text-secondary" id="listing-waiting-on">
            <span className="font-semibold">Not available yet.</span> Waiting on: {listing.waitingOn}
          </p>
        ) : null}
        {listing.connection?.lastRunSummary ? (
          <p className="text-tiny text-secondary/70">
            Last run {listing.connection.lastRunAt ? new Date(listing.connection.lastRunAt).toLocaleString() : ''}: {listing.connection.lastRunSummary}
          </p>
        ) : null}
        {message ? <p className={`text-small ${message.kind === 'error' ? 'text-red-600' : 'text-green-700'}`}>{message.text}</p> : null}
      </Card>

      {listing.setup.kind === 'accounting' && listing.config ? (
        <>
          <AccountingSetup listing={listing} config={listing.config as AccountingConfig} auth={auth} />
          {state === 'on' ? <ExportSection provider={listing.key} name={listing.name} auth={auth} branchId={branchId} /> : null}
        </>
      ) : null}
      {listing.setup.kind === 'review_requests' && listing.config ? (
        <ReviewSetup listing={listing} config={listing.config as ReviewRequestConfig} auth={auth} branchId={branchId} />
      ) : null}
    </>
  );
}

function SaveBar({ on, saving, onSave, message }: { on: boolean; saving: boolean; onSave: () => void; message: Message }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-secondary/20 pt-3">
      <Button type="button" onClick={onSave} loading={saving}>
        {on ? 'Save Settings' : 'Switch On'}
      </Button>
      {message ? (
        <p id="listing-save-message" className={`text-small ${message.kind === 'error' ? 'text-red-600' : 'text-green-700'}`}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Accounting (QuickBooks Online, Xero)
// ---------------------------------------------------------------------------

function AccountingSetup({ listing, config, auth }: { listing: ListingDetail; config: AccountingConfig; auth: AuthOpts }) {
  const save = useSaveConnectionMutation(listing.key, auth);
  const [draft, setDraft] = useState<AccountingConfig>(config);
  const [message, setMessage] = useState<Message>(null);
  const setup = listing.setup.kind === 'accounting' ? listing.setup : null;
  const isXero = listing.key === 'xero';
  const on = listingState(listing) === 'on';
  const fieldLabel = isXero ? 'account code' : 'account';

  const setAccount = (group: 'revenue' | 'payments', key: string, value: string) =>
    setDraft((current) => ({ ...current, accounts: { ...current.accounts, [group]: { ...current.accounts[group], [key]: value } } }));

  function submit() {
    setMessage(null);
    save.mutate(draft, {
      onSuccess: () => setMessage({ kind: 'ok', text: on ? 'Saved.' : `${listing.name} is on. Pick a date range below to export.` }),
      onError: (err) => setMessage({ kind: 'error', text: errorText(err, 'Couldn’t save the settings.') }),
    });
  }

  if (!setup) return null;
  return (
    <Section label="Accounts">
      <Card className="flex flex-col gap-4">
        {!listing.configured ? (
          <p className="text-small text-amber-700">
            These are suggestions. Check each one against your chart of accounts in {listing.name} — a line posted to an account that doesn’t exist stops the
            import.
          </p>
        ) : null}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1">
          <Select
            id="acct-date-format"
            label="Date format"
            options={setup.dateFormats.map((f) => ({ value: f, label: f }))}
            value={draft.dateFormat}
            onChange={(value) => setDraft((c) => ({ ...c, dateFormat: value }))}
            hint={`Match the format ${listing.name} uses for your company.`}
          />
          <Input
            id="acct-receivable"
            label={`Guest ledger (${fieldLabel})`}
            value={draft.accounts.receivable}
            onChange={(e) => setDraft((c) => ({ ...c, accounts: { ...c.accounts, receivable: e.target.value } }))}
            hint="Accounts receivable. Deposits sit here too until the stay."
          />
          <Input
            id="acct-tax"
            label={`Tax collected (${fieldLabel})`}
            value={draft.accounts.taxPayable}
            onChange={(e) => setDraft((c) => ({ ...c, accounts: { ...c.accounts, taxPayable: e.target.value } }))}
          />
        </div>

        <fieldset className="flex flex-col gap-1">
          <legend className="text-small font-semibold text-secondary pb-1">Revenue by department</legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1">
            {setup.departments.map((dept) => (
              <Input key={dept.key} id={`acct-revenue-${dept.key}`} label={dept.label} value={draft.accounts.revenue[dept.key] ?? ''} onChange={(e) => setAccount('revenue', dept.key, e.target.value)} />
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-1">
          <legend className="text-small font-semibold text-secondary pb-1">Money received, by payment method</legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1">
            {setup.methods.map((method) => (
              <Input
                key={method.key}
                id={`acct-payment-${method.key}`}
                label={method.label}
                value={draft.accounts.payments[method.key] ?? ''}
                onChange={(e) => setAccount('payments', method.key, e.target.value)}
              />
            ))}
          </div>
        </fieldset>

        {isXero ? (
          <div className="max-w-xs">
            <Input
              id="acct-xero-tax-rate"
              label="Xero tax rate on each line"
              value={draft.xeroTaxRate}
              onChange={(e) => setDraft((c) => ({ ...c, xeroTaxRate: e.target.value }))}
              hint="Tax is already its own line, so use your organisation’s no-tax rate (e.g. Tax Exempt, No VAT)."
            />
          </div>
        ) : null}

        <SaveBar on={on} saving={save.isPending} onSave={submit} message={message} />
      </Card>
    </Section>
  );
}

function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Yesterday, and the first of yesterday's month — the usual "month to date" an accountant asks for. */
function defaultRange(): { from: string; to: string } {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const first = new Date(yesterday.getFullYear(), yesterday.getMonth(), 1);
  return { from: isoDay(first), to: isoDay(yesterday) };
}

function ExportSection({ provider, name, auth, branchId }: { provider: string; name: string; auth: AuthOpts; branchId: string | null }) {
  const [range, setRange] = useState(defaultRange);
  const preview = useJournalPreviewMutation(provider, branchId, auth);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  async function download() {
    if (!branchId) return;
    setMessage(null);
    setDownloading(true);
    try {
      await downloadJournals(provider, branchId, range, auth);
      setMessage({ kind: 'ok', text: `Downloaded. In ${name}, import it as ${provider === 'xero' ? 'manual journals' : 'journal entries'}.` });
    } catch (err) {
      setMessage({ kind: 'error', text: errorText(err, 'Couldn’t download the file.') });
    } finally {
      setDownloading(false);
    }
  }

  const data = preview.data;
  return (
    <Section label="Export">
      <Card className="flex flex-col gap-3">
        {!branchId ? <p className="text-small text-secondary">Choose a property first — each property exports its own journals.</p> : null}
        <div className="grid grid-cols-1 sm:grid-cols-[10rem_10rem_auto_auto] gap-3 items-end">
          <Input id="export-from" label="From" type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
          <Input id="export-to" label="To" type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
          <Button
            type="button"
            variant="outline"
            className="mb-2"
            disabled={!branchId || !range.from || !range.to}
            loading={preview.isPending}
            onClick={() => {
              setMessage(null);
              preview.mutate(range, { onError: (err) => setMessage({ kind: 'error', text: errorText(err, 'Couldn’t build the journals.') }) });
            }}
          >
            Preview
          </Button>
          <Button type="button" className="mb-2" disabled={!branchId || !range.from || !range.to} loading={downloading} onClick={download}>
            Download CSV
          </Button>
        </div>
        <p className="text-tiny text-secondary/70">
          Up to 31 days at a time, both days included. Charges belong to the day of the stay they’re for, so a correction changes that day’s journal: export
          days once they’re settled, and export a corrected day again to replace it.
        </p>
        {message ? (
          <p id="export-message" className={`text-small ${message.kind === 'error' ? 'text-red-600' : 'text-green-700'}`}>
            {message.text}
          </p>
        ) : null}

        {data ? (
          data.journals.length === 0 ? (
            <p className="text-small text-secondary" id="export-preview">
              Nothing was charged or paid at {data.property} in that range.
            </p>
          ) : (
            <div className="flex flex-col gap-4" id="export-preview">
              <p className="text-small text-secondary">
                {data.journals.length} {data.journals.length === 1 ? 'journal' : 'journals'}, {data.lineCount} lines, in {data.currency}. Every day balances.
              </p>
              {data.journals.map((journal) => (
                <div key={journal.number} className="overflow-x-auto">
                  <p className="text-small font-semibold text-secondary">
                    {journal.date} · {journal.number}
                  </p>
                  <table className="w-full min-w-[32rem] text-small text-secondary">
                    <thead>
                      <tr className="text-left text-tiny text-secondary/70">
                        <th className="py-1 pr-3">Account</th>
                        <th className="py-1 pr-3">Description</th>
                        <th className="py-1 pr-3 text-right">Debit</th>
                        <th className="py-1 text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {journal.lines.map((line) => (
                        <tr key={`${journal.number}-${line.account}`} className="border-t border-secondary/10">
                          <td className="py-1 pr-3">{line.account}</td>
                          <td className="py-1 pr-3 text-secondary/80">{line.description}</td>
                          <td className="py-1 pr-3 text-right whitespace-nowrap">{line.debit === '0.00' ? '' : line.debit}</td>
                          <td className="py-1 text-right whitespace-nowrap">{line.credit === '0.00' ? '' : line.credit}</td>
                        </tr>
                      ))}
                      <tr className="border-t border-secondary/30 font-semibold">
                        <td className="py-1 pr-3" colSpan={2}>
                          Total
                        </td>
                        <td className="py-1 pr-3 text-right">{journal.totalDebit}</td>
                        <td className="py-1 text-right">{journal.totalCredit}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )
        ) : null}
      </Card>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Review requests
// ---------------------------------------------------------------------------

function ReviewSetup({ listing, config, auth, branchId }: { listing: ListingDetail; config: ReviewRequestConfig; auth: AuthOpts; branchId: string | null }) {
  const save = useSaveConnectionMutation(listing.key, auth);
  const on = listingState(listing) === 'on';
  const preview = useReviewPreviewQuery(branchId, on, auth);
  const [delayHours, setDelayHours] = useState(String(config.delayHours));
  const [links, setLinks] = useState<Record<string, string>>(config.links);
  const [subject, setSubject] = useState(config.subject);
  const [body, setBody] = useState(config.message);
  const [message, setMessage] = useState<Message>(null);
  const setup = listing.setup.kind === 'review_requests' ? listing.setup : null;

  function submit() {
    setMessage(null);
    save.mutate(
      { delayHours: Number(delayHours), links, subject, message: body },
      {
        onSuccess: () =>
          setMessage({
            kind: 'ok',
            text: on ? 'Saved.' : `Review requests are on. Guests who check out from now on will be asked ${delayHours} hours later.`,
          }),
        onError: (err) => setMessage({ kind: 'error', text: errorText(err, 'Couldn’t save the settings.') }),
      },
    );
  }

  if (!setup) return null;
  return (
    <>
      <Section label="Settings">
        <Card className="flex flex-col gap-4">
          <div className="max-w-xs">
            <Input
              id="review-delay"
              label="Hours after check-out"
              type="number"
              min={1}
              max={168}
              value={delayHours}
              onChange={(e) => setDelayHours(e.target.value)}
              hint="1 to 168 (a week)."
            />
          </div>
          <fieldset className="flex flex-col gap-1">
            <legend className="text-small font-semibold text-secondary pb-1">Review page for each property</legend>
            <p className="text-tiny text-secondary/70 pb-1">A property with no link isn’t asked for reviews. Links must start with https://.</p>
            {setup.properties.map((property) => (
              <Input
                key={property.id}
                id={`review-link-${property.id}`}
                label={property.name}
                type="url"
                value={links[property.id] ?? ''}
                onChange={(e) => setLinks((current) => ({ ...current, [property.id]: e.target.value }))}
                placeholder="https://g.page/r/…/review"
              />
            ))}
          </fieldset>
          <Input id="review-subject" label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
          <Textarea
            id="review-message"
            label="Message"
            rows={8}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            hint={`Available: ${setup.placeholders.map((p) => `{{${p}}}`).join(', ')}. The message must include {{review_url}}.`}
          />
          <SaveBar on={on} saving={save.isPending} onSave={submit} message={message} />
        </Card>
      </Section>

      {on ? (
        <Section label="What guests receive">
          <Card className="flex flex-col gap-2">
            {preview.isError ? (
              <p className="text-small text-red-600">{errorText(preview.error, 'Couldn’t preview it.')}</p>
            ) : preview.data ? (
              <div id="review-preview" className="flex flex-col gap-2">
                <p className="text-small text-secondary">
                  <span className="font-semibold">Subject:</span> {preview.data.subject}
                </p>
                <p className="text-small text-secondary whitespace-pre-wrap">{preview.data.body}</p>
                {!preview.data.reviewUrl ? <p className="text-small text-amber-700">This property has no review page yet, so its guests aren’t asked.</p> : null}
              </div>
            ) : (
              <p className="text-small text-secondary">{branchId ? 'Loading…' : 'Choose a property to preview.'}</p>
            )}
          </Card>
        </Section>
      ) : null}
    </>
  );
}
