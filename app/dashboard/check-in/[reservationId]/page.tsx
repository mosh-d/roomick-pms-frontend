'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { LogoUpload } from '@/components/ui/LogoUpload';
import { PageHeader } from '@/components/ui/PageHeader';
import { BackButton } from '@/components/ui/BackButton';
import { HotelCheckInIcon } from '@/components/ui/Icons';
import { useReservationQuery, useCheckInMutation } from '@/lib/reservations';
import { useRoomsQuery } from '@/lib/rooms';
import { groupRoomsByFloor } from '@/lib/groupRoomsByFloor';
import { RoomGrid } from '../../_components/RoomGrid';
import { ApiError, apiFetch } from '@/lib/api';
import type { IdDocType, IdDocumentInput } from '@/lib/guests';
import { useAuthStore } from '@/lib/store/authStore';

const ID_DOC_TYPE_OPTIONS: SelectOption[] = [
  { value: 'passport', label: 'Passport' },
  { value: 'national_id', label: 'National ID' },
  { value: 'drivers_license', label: "Driver's License" },
];

/** `LogoUpload` only reads/produces a `File` — the backend wants a plain base64 string with no `"data:"` prefix (`IdDocumentInput.photoBase64`'s own doc comment). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:.*;base64,/, ''));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the selected file.'));
    reader.readAsDataURL(file);
  });
}

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
 */
export default function CheckInFlowPage() {
  const params = useParams<{ reservationId: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [idDocType, setIdDocType] = useState<string | null>(null);
  const [idDocNumber, setIdDocNumber] = useState('');
  const [idDocExpiryDate, setIdDocExpiryDate] = useState('');
  const [nationality, setNationality] = useState('');
  const [idPhoto, setIdPhoto] = useState<File | null>(null);

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

  if (!activeBranchId) return null;

  async function handleConfirm() {
    if (!selectedRoomId) return;
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
        nationality: nationality.trim() || undefined,
        photoBase64: idPhoto ? await fileToBase64(idPhoto) : undefined,
      };
    }

    try {
      await checkInMutation.mutateAsync({ reservationId: params.reservationId, roomId: selectedRoomId, idDocument });
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
      <BackButton fallbackHref="/dashboard/arrivals" />
      <PageHeader icon={<HotelCheckInIcon className="size-8" />} title="Check-In Flow" subtitle="Check a guest in" />

      {reservationQuery.isLoading || roomsQuery.isLoading ? (
        <p className="text-body text-primary-dark/70">Loading…</p>
      ) : reservationQuery.isError || !reservation ? (
        <p className="text-body text-red-600">Could not load this reservation.</p>
      ) : reservation.status !== 'confirmed' ? (
        <p className="text-body text-red-600">This reservation is already {reservation.status.replace('_', ' ')} — nothing to check in.</p>
      ) : (
        <>
          <Section label="Guest Details" tone="accent">
            <Row label="Name" value={reservation.guest.name} />
            <Row label="Email" value={reservation.guest.email ?? 'NIL'} />
            <Row label="Phone" value={reservation.guest.phone ?? 'NIL'} />
            <Row label="Room Type" value={reservation.roomType.name} />
            <Row label="Confirmation #" value={reservation.confirmationNumber} />
          </Section>

          <Section label="Room Selection">
            {buildings.length === 0 ? (
              <p className="text-body text-primary-dark/70">No ready rooms of this type — nothing vacant and clean/inspected right now.</p>
            ) : (
              <RoomGrid buildings={buildings} selectedRoomId={selectedRoomId} onSelectRoom={setSelectedRoomId} />
            )}
          </Section>

          <Section label="ID Capture">
            <p className="text-small text-secondary-light">Optional — can be captured later from the guest&apos;s profile. Never blocks check-in.</p>
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
              <div className="w-32">
                <Input
                  name="nationality"
                  label="Nationality"
                  placeholder="NG"
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value.toUpperCase())}
                  maxLength={2}
                />
              </div>
            </div>
            <LogoUpload label="ID Document Photo" file={idPhoto} onFileChange={setIdPhoto} hint="Optional — a clear photo of the front of the document" />
          </Section>

          {actionError ? <p className="text-small text-red-600">{actionError}</p> : null}

          <Button type="button" onClick={handleConfirm} disabled={!selectedRoomId || checkInMutation.isPending} loading={checkInMutation.isPending} className="self-start">
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
      <span className="text-body font-semibold text-primary-dark">{value}</span>
    </div>
  );
}
