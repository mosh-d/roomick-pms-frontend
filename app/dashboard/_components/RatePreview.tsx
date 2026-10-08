import { Card } from '@/components/ui/Card';
import { formatMoney } from '@/lib/numberFormat';
import { currencySymbolFor } from '@/lib/currencies';
import { useCalculateRateQuery } from '@/lib/rate-resolver';

/**
 * Ref: Rate Resolver Service — "Frontend RatePreview component: calls
 * endpoint on mount, re-fetches on prop change, never caches locally."
 * Shared between Create Reservation and Walk-In Booking rather than
 * duplicated — both need the identical live-quote behavior, just with
 * different surrounding forms.
 */
export function RatePreview({
  branchId,
  currency,
  roomTypeId,
  checkInDate,
  checkOutDate,
  promoCode,
  corporateAccountId,
  accessToken,
  tenantId,
}: {
  branchId: string | null;
  currency: string | undefined;
  roomTypeId: string | null;
  checkInDate: string | null;
  checkOutDate: string | null;
  promoCode?: string;
  corporateAccountId?: string;
  accessToken: string | undefined;
  tenantId: string | undefined;
}) {
  const quoteQuery = useCalculateRateQuery(branchId, { roomTypeId, checkInDate, checkOutDate, promoCode, corporateAccountId }, { accessToken, tenantId });

  if (!roomTypeId || !checkInDate || !checkOutDate || checkOutDate <= checkInDate) return null;

  // The quote carries the branch's currency, so a caller that doesn't know it still shows a symbol.
  const symbol = currencySymbolFor(currency ?? quoteQuery.data?.currency);

  return (
    <Card tone="accent" className="flex flex-col gap-1">
      {quoteQuery.isPending ? (
        <p className="text-small text-surface">Calculating rate…</p>
      ) : quoteQuery.isError ? (
        <p className="text-small text-red-600">Couldn&apos;t calculate the rate for this stay.</p>
      ) : quoteQuery.data ? (
        <>
          <div className="flex items-center justify-between">
            <span className="text-small text-surface">
              {quoteQuery.data.perNight.length} {quoteQuery.data.perNight.length === 1 ? 'night' : 'nights'} · avg {formatMoney(quoteQuery.data.nightlyRate, symbol)}/night
            </span>
            <span className="text-small font-semibold text-surface">
              {quoteQuery.data.ruleApplied.type === 'base' ? 'Standard Rate' : (quoteQuery.data.ruleApplied.planName ?? 'Adjusted Rate')}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-small text-surface">Subtotal</span>
            <span className="text-small text-surface">{formatMoney(quoteQuery.data.subtotal, symbol)}</span>
          </div>
          {Number(quoteQuery.data.taxTotal) > 0 ? (
            <div className="flex items-center justify-between">
              <span className="text-small text-surface">Tax</span>
              <span className="text-small text-surface">{formatMoney(quoteQuery.data.taxTotal, symbol)}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between border-t border-accent-dark/20 pt-1 mt-1">
            <span className="text-small font-semibold text-surface">Total</span>
            <span className="text-body font-semibold text-surface">{formatMoney(quoteQuery.data.totalWithTax, symbol)}</span>
          </div>
          {Number(quoteQuery.data.taxIncluded) > 0 ? (
            <p className="text-tiny text-surface-muted text-right">Includes {formatMoney(quoteQuery.data.taxIncluded, symbol)} tax</p>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}
