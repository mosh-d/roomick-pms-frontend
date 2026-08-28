'use client';

import { useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { SignaturePad, type SignaturePadHandle } from '@/components/ui/SignaturePad';
import { HotelCheckInIcon } from '@/components/ui/Icons';
import { useRegistrationCardQuery, useSignRegistrationCardMutation } from '@/lib/registration-cards';
import { formatMoney } from '@/lib/numberFormat';
import { currencySymbolFor } from '@/lib/currencies';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';

/**
 * Guest Registration Card (ref: Month 3) — "auto-generated when check-in
 * is triggered", so this page's usual entry point is a redirect straight
 * from Check-In Flow / Walk-In Booking, not a link someone clicks into
 * cold. Scoped to DB-only storage, by explicit choice: no S3/PDF-
 * generation infrastructure exists in this project, so `signatureData` is
 * a plain base64 PNG stored on the row and this page itself — not a
 * generated file — stands in for the "document". `window.print()` is the
 * closest thing to a downloadable PDF this pass offers (see the sidebar
 * and header both gaining `print:hidden` for a clean printed page).
 */
export default function RegistrationCardPage() {
  const params = useParams<{ cardId: string }>();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const [formError, setFormError] = useState<string | null>(null);
  const padRef = useRef<SignaturePadHandle>(null);

  const cardQuery = useRegistrationCardQuery(params.cardId, auth);
  const signMutation = useSignRegistrationCardMutation(auth);

  const card = cardQuery.data;

  async function handleSign() {
    const dataUrl = padRef.current?.getDataUrl();
    if (!dataUrl || !card) {
      setFormError('Sign in the box above first.');
      return;
    }
    setFormError(null);
    try {
      await signMutation.mutateAsync({ cardId: card.id, signatureData: dataUrl });
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <Container className="max-w-3xl py-10 flex flex-col gap-6">
      <PageHeader icon={<HotelCheckInIcon className="size-8" />} title="Guest Registration Card" subtitle="Check-in record" />

      {cardQuery.isLoading ? (
        <p className="text-body text-primary-dark/70">Loading…</p>
      ) : cardQuery.isError || !card ? (
        <p className="text-body text-red-600">Could not load this registration card.</p>
      ) : (
        <>
          {card.fields.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- an operator-supplied external URL, not an app asset next/image can optimize
            <img src={card.fields.logoUrl} alt="" className="h-12 w-auto self-start" />
          ) : null}

          <Section label="Guest Details" tone="accent">
            <Row label="Name" value={card.fields.guestName} />
            <Row label="Email" value={card.fields.guestEmail ?? 'NIL'} />
            <Row label="Phone" value={card.fields.guestPhone ?? 'NIL'} />
            <Row label="Confirmation #" value={card.fields.confirmationNumber} />
          </Section>

          <Section label="Stay Details" tone="accent">
            <Row label="Room" value={card.fields.roomNumber ?? 'NIL'} />
            <Row label="Room Type" value={card.fields.roomType} />
            <Row label="Check-In" value={new Date(card.fields.checkInDate).toLocaleDateString()} />
            <Row label="Check-Out" value={new Date(card.fields.checkOutDate).toLocaleDateString()} />
            <Row label="Adults / Children" value={`${card.fields.adults} / ${card.fields.children}`} />
            <Row label="Rate" value={formatMoney(card.fields.rate, currencySymbolFor(card.fields.currency))} />
          </Section>

          {card.fields.houseRules ? (
            <Section label="House Rules">
              <p className="text-body text-secondary whitespace-pre-wrap">{card.fields.houseRules}</p>
            </Section>
          ) : null}

          <Section label="Signature">
            {card.signedAt ? (
              <div className="flex flex-col gap-3">
                {card.signatureData ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a base64 data: URL, not an app asset next/image can optimize
                  <img src={card.signatureData} alt="Guest signature" className="h-24 w-auto rounded-card border border-secondary-light/40 bg-white" />
                ) : null}
                <p className="text-small text-secondary-light">Signed {new Date(card.signedAt).toLocaleString()}</p>
                <Button type="button" variant="outline" onClick={() => window.print()} className="self-start print:hidden">
                  Print
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <SignaturePad ref={padRef} />
                {formError ? <p className="text-small text-red-600">{formError}</p> : null}
                <Button type="button" loading={signMutation.isPending} onClick={handleSign} className="self-start">
                  Sign
                </Button>
              </div>
            )}
          </Section>
        </>
      )}
    </Container>
  );
}

/** Matches `check-in/[reservationId]/page.tsx`'s own Row exactly — same Guest Details anatomy, same reasoning for the `text-accent-dark` label. */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-small text-accent-dark">{label}</span>
      <span className="text-body font-semibold text-primary-dark">{value}</span>
    </div>
  );
}
