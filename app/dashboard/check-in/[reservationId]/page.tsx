'use client';

import { Suspense, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { CameraCapture } from '@/components/ui/CameraCapture';
import { PageHeader } from '@/components/ui/PageHeader';
import { BackButton } from '@/components/ui/BackButton';
import { ForwardButton } from '@/components/ui/ForwardButton';
import { HotelCheckInIcon } from '@/components/ui/Icons';
import { useReservationQuery, useCheckInMutation } from '@/lib/reservations';
import { useRoomsQuery, type RoomWithDetails } from '@/lib/rooms';
import { groupRoomsByFloor } from '@/lib/groupRoomsByFloor';
import { RoomGrid } from '../../_components/RoomGrid';
import { RoomPicker, isReady } from '../../_components/RoomPicker';
import { ApiError, apiFetch } from '@/lib/api';
import type { IdDocType, IdDocumentInput } from '@/lib/guests';
import { COUNTRIES } from '@/lib/countries';
import { formatDateOnly, formatMomentDate, hotelToday } from '@/lib/dates';
import { useAuthStore } from '@/lib/store/authStore';

const ID_DOC_TYPE_OPTIONS: SelectOption[] = [
  { value: 'passport', label: 'Passport' },
  { value: 'national_id', label: 'National ID' },
  { value: 'drivers_license', label: "Driver's License" },
];

/**
 * Check-In Flow (Roomick-UI.pdf page 12/13) — guest summary, room
 * assignment, and ID Capture. Payment stays deferred (it's a Guest Folio
 * concern post check-in, not this page's job); ID Capture is real now that
 * `EncryptionService`/`DocumentStorageAdapter` exist — `RecordIdDocumentDto`
 * is genuinely optional here and never blocks Confirm Check-In, matching
 * the backend's own "warn, don't block" design. Reuses `RoomGrid`/`RoomCell`
 * exactly as `room-status-board/page.tsx` composes them, filtered to
 * vacant/clean-or-inspected rooms of the reservation's own room type — the
 * same client-side filter, no new backend endpoint needed for the list.
 *
 * **Manual Room Override** (ref: "Receptionist selects room manually"):
 * every free room, any type, floor or cleaning state, through the same
 * filters as Room Move. A room of another type, or one still being cleaned,
 * needs the reason — kept in the audit log. Another type moves the stay to
 * it at the booked rate (the backend pins it). `?override=1` (the Front
 * Desk card) opens straight into it.
 */
export default function CheckInFlowPage() {
  return (
    // useSearchParams needs a Suspense boundary under the App Router.
    <Suspense fallback={null}>
      <CheckInFlow />
    </Suspense>
  );
}

function CheckInFlow() {
  const params = useParams<{ reservationId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [overrideMode, setOverrideMode] = useState(search.get('override') === '1');
  const [overrideRoom, setOverrideRoom] = useState<RoomWithDetails | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const [idDocType, setIdDocType] = useState<string | null>(null);
  const [idDocNumber, setIdDocNumber] = useState('');
  const [idDocExpiryDate, setIdDocExpiryDate] = useState('');
  const [nationality, setNationality] = useState<string | null>(null);
  const [idPhotoBase64, setIdPhotoBase64] = useState<string | null>(null);

  const reservationQuery = useReservationQuery(params.reservationId, auth);
  const roomsQuery = useRoomsQuery(activeBranchId, auth);
  const checkInMutation = useCheckInMutation(activeBranchId ?? '', auth);

  const reservation = reservationQuery.data;

  const readyRooms = useMemo(() => {
    if (!reservation) return [];
    return (roomsQuery.data ?? []).filter(
      (room) =>
        room.roomType.id === reservation.roomType.id &&
        room.occupancyStatus === 'vacant' &&
        room.heldStatus === null &&
        (['clean', 'inspected'] as string[]).includes(room.cleanlinessStatus),
    );
  }, [roomsQuery.data, reservation]);

  const buildings = useMemo(() => groupRoomsByFloor(readyRooms), [readyRooms]);

  // Nights between the booked arrival and today — they post at check-in, and the agent should know before pressing the button.
  const missedNights = reservation
    ? Math.max(0, Math.round((new Date(`${hotelToday()}T00:00:00.000Z`).getTime() - new Date(`${reservation.checkInDate.slice(0, 10)}T00:00:00.000Z`).getTime()) / 86_400_000))
    : 0;

  const chosenRoomId = overrideMode ? (overrideRoom?.id ?? null) : selectedRoomId;
  /** Another type, or not ready yet — what the override is for, and what needs a reason. */
  const needsReason = Boolean(overrideMode && overrideRoom && reservation && (overrideRoom.roomType.id !== reservation.roomType.id || !isReady(overrideRoom)));

  if (!activeBranchId) return null;

  async function handleConfirm() {
    if (!chosenRoomId) return;
    if (needsReason && !overrideReason.trim()) {
      setActionError('Give the reason for the override — it goes in the audit log.');
      return;
    }
    setActionError(null);

    // Both-or-neither: a type with no number (or vice versa) can't produce
    // a valid RecordIdDocumentDto, but leaving every ID field blank is the
    // normal "capture it later" path and must never block check-in.
    let idDocument: IdDocumentInput | undefined;
    if (idDocType || idDocNumber.trim()) {
      if (!idDocType || !idDocNumber.trim()) {
        setActionError('Select an ID type and enter the ID number, or leave both blank to capture it later.');
        return;
      }
      idDocument = {
        idDocType: idDocType as IdDocType,
        idDocNumber: idDocNumber.trim(),
        idDocExpiryDate: idDocExpiryDate || undefined,
        nationality: nationality ?? undefined,
        photoBase64: idPhotoBase64 ?? undefined,
      };
    }

    try {
      await checkInMutation.mutateAsync({
        reservationId: params.reservationId,
        roomId: chosenRoomId,
        idDocument,
        overrideReason: needsReason ? overrideReason.trim() : undefined,
      });
      // Check-in auto-generates the registration card server-side (ref:
      // "auto-generated when check-in is triggered") — send the agent
      // straight there to have the guest sign, rather than back to a list.
      const card = await apiFetch<{ id: string } | null>(`/reservations/${params.reservationId}/registration-card`, auth);
      router.push(card ? `/dashboard/registration-cards/${card.id}` : '/dashboard/arrivals');
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <BackButton fallbackHref="/dashboard/arrivals" />
        <ForwardButton />
      </div>
      <PageHeader icon={<HotelCheckInIcon className="size-8" />} title="Check-In Flow" subtitle="Check a guest in" />

      {reservationQuery.isLoading || roomsQuery.isLoading ? (
        <p className="text-body text-surface-muted">Loading…</p>
      ) : reservationQuery.isError || !reservation ? (
        <p className="text-body text-red-600">Could not load this reservation.</p>
      ) : reservation.status !== 'confirmed' ? (
        <p className="text-body text-red-600">This reservation is already {reservation.status.replace('_', ' ')} — nothing to check in.</p>
      ) : (
        <>
          {/* Tells the agent the contact details below were confirmed by the
              guest themselves, so there's nothing to re-key — the operational
              payoff of online check-in, which is invisible without this. */}
          {reservation.preArrivalCompletedAt ? (
            <p className="text-small text-green-700 font-semibold">
              Guest checked in online on {formatMomentDate(reservation.preArrivalCompletedAt)} — details below are confirmed by them
              {reservation.estimatedArrivalTime ? `, arriving around ${reservation.estimatedArrivalTime}` : ''}. Photo ID still needs checking.
            </p>
          ) : null}

          <Section label="Guest Details" tone="accent">
            <Row label="Name" value={reservation.guest.name} />
            <Row label="Email" value={reservation.guest.email ?? 'NIL'} />
            <Row label="Phone" value={reservation.guest.phone ?? 'NIL'} />
            <Row label="Room Type" value={reservation.roomType.name} />
            <Row label="Confirmation #" value={reservation.confirmationNumber} />
            {reservation.estimatedArrivalTime ? <Row label="Expected Arrival" value={reservation.estimatedArrivalTime} /> : null}
          </Section>

          {missedNights > 0 ? (
            <p className="rounded-card border border-amber-300 bg-amber-50 px-4 py-3 text-small text-amber-900" id="late-arrival-notice">
              <span className="font-semibold">Arrived late.</span> This booking was due on {formatDateOnly(reservation.checkInDate)}; the {missedNights}{' '}
              {missedNights === 1 ? 'night' : 'nights'} since then {missedNights === 1 ? 'is' : 'are'} billed to the folio at check-in, as booked. Modify the
              reservation first if the guest shouldn’t pay for them.
            </p>
          ) : null}

          <Section label="Room Selection">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-small text-surface-muted">
                {overrideMode
                  ? `Manual override — any free room. Another type than ${reservation.roomType.name}, or a room still being cleaned, needs a reason.`
                  : `Ready ${reservation.roomType.name} rooms.`}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setOverrideMode((on) => !on);
                  setOverrideRoom(null);
                  setSelectedRoomId(null);
                }}
              >
                {overrideMode ? 'Back to ready rooms' : 'Manual room override'}
              </Button>
            </div>
            {overrideMode ? (
              <>
                <RoomPicker rooms={roomsQuery.data ?? []} initialTypeId={reservation.roomType.id} selectedRoomId={overrideRoom?.id ?? null} onSelect={setOverrideRoom} />
                {overrideRoom ? (
                  <p className="text-small text-surface">
                    Room {overrideRoom.number} — {overrideRoom.roomType.name}
                    {overrideRoom.roomType.id !== reservation.roomType.id ? ` (booked: ${reservation.roomType.name}; the guest keeps the booked rate)` : ''}
                    {isReady(overrideRoom) ? '' : ` — ${overrideRoom.cleanlinessStatus.replace('_', ' ')}, not ready yet`}
                  </p>
                ) : null}
                {needsReason ? (
                  <Input
                    name="overrideReason"
                    label="Override reason"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    maxLength={300}
                    hint="Required — kept in the audit log"
                  />
                ) : null}
              </>
            ) : buildings.length === 0 ? (
              <p className="text-body text-surface-muted">No ready rooms of this type — nothing vacant and clean/inspected right now. Use the manual room override to choose another.</p>
            ) : (
              <RoomGrid buildings={buildings} selectedRoomId={selectedRoomId} onSelectRoom={setSelectedRoomId} />
            )}
          </Section>

          <Section label="ID Capture">
            <p className="text-small text-surface-muted">Optional — can be captured later from the guest&apos;s profile. Never blocks check-in.</p>
            <div className="flex flex-wrap gap-4">
              <div className="w-48">
                <Select id="idDocType" name="idDocType" label="ID Type" options={ID_DOC_TYPE_OPTIONS} value={idDocType} onChange={setIdDocType} placeholder="Select type" />
              </div>
              <div className="w-56">
                <Input
                  name="idDocNumber"
                  label="ID Number"
                  value={idDocNumber}
                  onChange={(e) => setIdDocNumber(e.target.value)}
                  maxLength={50}
                />
              </div>
              <div className="w-44">
                <Input name="idDocExpiryDate" label="Expiry Date" type="date" value={idDocExpiryDate} onChange={(e) => setIdDocExpiryDate(e.target.value)} />
              </div>
              <div className="w-56">
                <Select id="nationality" name="nationality" label="Nationality" options={COUNTRIES} value={nationality} onChange={setNationality} placeholder="Select country" />
              </div>
            </div>
            <CameraCapture label="ID Document Photo" photoBase64={idPhotoBase64} onCapture={setIdPhotoBase64} hint="Optional — a clear photo of the front of the document" />
          </Section>

          {actionError ? <p className="text-small text-red-600">{actionError}</p> : null}

          <Button type="button" onClick={handleConfirm} disabled={!chosenRoomId || checkInMutation.isPending} loading={checkInMutation.isPending} className="self-start">
            Confirm Check-In
          </Button>
        </>
      )}
    </Container>
  );
}

/** Always rendered inside the `tone="accent"` Guest Details Section — label uses `text-accent-dark` to stay in the same slate family as the card, matching `ReviewStep.tsx`'s identical Row and its own note on why. */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-small text-accent-dark">{label}</span>
      <span className="text-body font-semibold text-surface">{value}</span>
    </div>
  );
}
