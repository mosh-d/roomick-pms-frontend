'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ApiError } from '@/lib/api';
import { useGuestLoyaltyQuery, useRedeemPointsMutation } from '@/lib/loyalty';
import { formatMoney } from '@/lib/numberFormat';

/**
 * Pays part of the bill with the guest's loyalty points. Shown only for a
 * member with points while the programme is on. The server values the points
 * and caps the payment at what the bill owes; the "most you can use" hint here
 * is only a convenience.
 */
export function RedeemPointsCard({
  folioId,
  guest,
  balanceDue,
  currencySymbol,
  auth,
}: {
  folioId: string;
  guest: { id: string; name: string };
  balanceDue: string;
  currencySymbol: string;
  auth: { accessToken: string | undefined; tenantId: string | undefined };
}) {
  const loyaltyQuery = useGuestLoyaltyQuery(guest.id, auth);
  const redeem = useRedeemPointsMutation(folioId, auth);
  const [points, setPoints] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const loyalty = loyaltyQuery.data;

  // Stays on screen after the last point is spent, so the confirmation isn't lost with it.
  if (!loyalty || !loyalty.programActive || !loyalty.enrolledAt || (loyalty.balance <= 0 && !message)) return null;

  const pointValue = Number(loyalty.pointValue);
  const owed = Math.max(0, Number(balanceDue));
  const most = pointValue > 0 ? Math.min(loyalty.balance, Math.floor(owed / pointValue + 1e-9)) : 0;

  async function submit() {
    setMessage(null);
    try {
      const result = await redeem.mutateAsync(Number(points));
      setMessage({ kind: 'ok', text: `Redeemed ${result.pointsRedeemed.toLocaleString()} points for ${formatMoney(result.amount, currencySymbol)}. ${result.balance.toLocaleString()} points left.` });
      setPoints('');
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.' });
    }
  }

  return (
    <Card tone="primary" className="flex flex-col gap-3 max-w-2xl">
      <p className="text-body font-semibold text-secondary">Redeem Points</p>
      {loyalty.balance <= 0 ? (
        <p className="text-small text-secondary">{guest.name} has no points left.</p>
      ) : (
        <p className="text-small text-secondary">
          {guest.name} has {loyalty.balance.toLocaleString()} points{loyalty.tier ? ` (${loyalty.tier.name})` : ''}, each worth {formatMoney(loyalty.pointValue ?? '0', currencySymbol)}.
          {most > 0 ? ` The most this bill can take is ${most.toLocaleString()}.` : ' This bill has nothing left to pay.'}
        </p>
      )}
      {most > 0 ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <Input id="redeem-points" label="Points" type="number" min={1} max={most} value={points} onChange={(e) => setPoints(e.target.value)} />
          </div>
          <Button type="button" size="sm" variant="outline" className="mb-2" onClick={() => setPoints(String(most))}>
            Use {most.toLocaleString()}
          </Button>
          <Button type="button" className="mb-1" onClick={submit} loading={redeem.isPending} disabled={!points || !Number.isInteger(Number(points)) || Number(points) < 1}>
            Redeem
          </Button>
        </div>
      ) : null}
      {message ? <p className={`text-small ${message.kind === 'error' ? 'text-red-600' : 'text-green-700'}`}>{message.text}</p> : null}
    </Card>
  );
}
