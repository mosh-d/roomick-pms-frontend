'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select, type SelectOption } from '@/components/ui/Select';
import { PageHeader } from '@/components/ui/PageHeader';
import { HotelCheckInIcon } from '@/components/ui/Icons';
import { ApiError } from '@/lib/api';
import { useArrivalsQuery, useGroupCheckInMutation, type GroupCheckInResult, type ReservationSummary } from '@/lib/reservations';
import { useRoomsQuery, type RoomWithDetails } from '@/lib/rooms';
import { useAuthStore } from '@/lib/store/authStore';
import { GuestNameCell } from '../_components/GuestNameCell';
import { isReady } from '../_components/RoomPicker';

/**
 * Group Check-In — a group block's arrivals checked in together (the
 * usage-feedback gap: rooms booked as one group could only be checked in
 * one by one). Each guest gets a ready room of their type, filled in for
 * the desk to change; the whole group goes in at once, or — if one room
 * turns out to be taken — none of it does.
 *
 * Optionally the group's room nights go on one **master bill** on the lead
 * guest's stay, paid by the group's organiser; each guest's incidentals stay
 * on their own bill.
 */
export default function GroupCheckInPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const [blockId, setBlockId] = useState<string | null>(null);
  const [included, setIncluded] = useState<Set<string>>(new Set());
  const [chosenRooms, setChosenRooms] = useState<Record<string, string>>({});
  const [masterBill, setMasterBill] = useState(false);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GroupCheckInResult | null>(null);

  const arrivalsQuery = useArrivalsQuery(activeBranchId, undefined, auth);
  const roomsQuery = useRoomsQuery(activeBranchId, auth);
  const groupMutation = useGroupCheckInMutation(activeBranchId ?? '', auth);

  const groups = useMemo(() => {
    const byBlock = new Map<string, { id: string; name: string; arrivals: ReservationSummary[] }>();
    for (const r of arrivalsQuery.data ?? []) {
      if (!r.groupBlock) continue;
      const entry = byBlock.get(r.groupBlock.id) ?? { id: r.groupBlock.id, name: r.groupBlock.name, arrivals: [] };
      entry.arrivals.push(r);
      byBlock.set(r.groupBlock.id, entry);
    }
    return [...byBlock.values()];
  }, [arrivalsQuery.data]);
  const group = groups.find((g) => g.id === blockId) ?? null;
  const groupOptions: SelectOption[] = groups.map((g) => ({ value: g.id, label: `${g.name} — ${g.arrivals.length} arriving` }));

  const readyRooms = useMemo(() => (roomsQuery.data ?? []).filter((room) => room.occupancyStatus === 'vacant' && room.heldStatus === null && isReady(room)), [roomsQuery.data]);

  /** Each included guest's room: the desk's choice, else the next ready room of their type nobody else has. */
  const assigned = useMemo(() => {
    const out: Record<string, RoomWithDetails | undefined> = {};
    if (!group) return out;
    const taken = new Set(Object.entries(chosenRooms).filter(([id]) => included.has(id)).map(([, roomId]) => roomId));
    for (const r of group.arrivals) {
      if (!included.has(r.id)) continue;
      const chosen = chosenRooms[r.id] ? readyRooms.find((room) => room.id === chosenRooms[r.id]) : undefined;
      if (chosen) {
        out[r.id] = chosen;
        continue;
      }
      const next = readyRooms
        .filter((room) => room.roomType.id === r.roomType.id && !taken.has(room.id))
        .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))[0];
      if (next) {
        taken.add(next.id);
        out[r.id] = next;
      }
    }
    return out;
  }, [group, included, chosenRooms, readyRooms]);

  function pickGroup(id: string) {
    const next = groups.find((g) => g.id === id);
    setBlockId(id);
    setIncluded(new Set(next?.arrivals.map((r) => r.id) ?? []));
    setChosenRooms({});
    setLeadId(next?.arrivals[0]?.id ?? null);
    setMasterBill(false);
    setResult(null);
    setError(null);
  }

  function toggle(id: string) {
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const going = group ? group.arrivals.filter((r) => included.has(r.id)) : [];
  const missingRoom = going.some((r) => !assigned[r.id]);
  const roomsUsed = going.map((r) => assigned[r.id]?.id).filter(Boolean);
  const clash = new Set(roomsUsed).size !== roomsUsed.length;
  const leadGoing = !masterBill || (leadId !== null && included.has(leadId));
  const canSubmit = Boolean(group && going.length > 0 && !missingRoom && !clash && leadGoing);

  async function handleCheckIn() {
    if (!group || !canSubmit) return;
    setError(null);
    try {
      const done = await groupMutation.mutateAsync({
        blockId: group.id,
        assignments: going.map((r) => ({ reservationId: r.id, roomId: (assigned[r.id] as RoomWithDetails).id })),
        masterBill: masterBill && leadId ? { leadReservationId: leadId } : undefined,
      });
      setResult(done);
      setBlockId(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not check the group in.');
    }
  }

  if (!activeBranchId) return null;

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader icon={<HotelCheckInIcon className="size-8" />} title="Group Check-In" subtitle="A group's arrivals into their rooms together." roles="Front Desk" />

      {error ? <p className="text-small text-red-600">{error}</p> : null}
      {result ? (
        <Card tone="secondary" className="flex flex-col gap-2">
          <p className="text-small font-semibold text-secondary">Checked in {result.checkedIn.length} guests.</p>
          <ul className="text-small text-secondary list-disc pl-5">
            {result.checkedIn.map((c) => (
              <li key={c.reservationId}>
                Room {c.roomNumber ?? '?'} — {c.guestName} ({c.confirmationNumber})
              </li>
            ))}
          </ul>
          {result.masterFolioId ? (
            <Link href={`/dashboard/billing/${result.masterFolioId}`} className="text-small text-secondary underline underline-offset-2 self-start">
              Open the group&apos;s master bill
            </Link>
          ) : null}
        </Card>
      ) : null}

      <Section label="Group">
        {arrivalsQuery.isLoading ? (
          <p className="text-body text-primary-dark/70">Loading today&apos;s arrivals…</p>
        ) : groups.length === 0 ? (
          <p className="text-body text-primary-dark/70">No group is arriving today. Guests booked into a group block from Sales &amp; Events show here on their arrival day.</p>
        ) : (
          <Select id="group-block" name="blockId" label="Arriving group" options={groupOptions} value={blockId} onChange={pickGroup} />
        )}
      </Section>

      {group ? (
        <>
          <Section label="Guests and Rooms">
            <p className="text-small text-primary-dark/70">Each guest gets a ready room of their type — change any of them, or leave a guest out to check them in later.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-primary/25">
                    <th className="pb-2 pr-4 w-10" />
                    <th className="text-small font-bold text-primary-dark pb-2 pr-4">Guest</th>
                    <th className="text-small font-bold text-primary-dark pb-2 pr-4">Confirmation #</th>
                    <th className="text-small font-bold text-primary-dark pb-2 pr-4">Room Type</th>
                    <th className="text-small font-bold text-primary-dark pb-2 min-w-48">Room</th>
                  </tr>
                </thead>
                <tbody>
                  {group.arrivals.map((r) => {
                    const room = assigned[r.id];
                    const options: SelectOption[] = readyRooms
                      .filter((option) => option.roomType.id === r.roomType.id && (option.id === room?.id || !roomsUsed.includes(option.id)))
                      .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
                      .map((option) => ({ value: option.id, label: `Room ${option.number}` }));
                    return (
                      <tr key={r.id} className="border-b border-primary/15 last:border-0">
                        <td className="py-3 pr-4">
                          <input
                            type="checkbox"
                            checked={included.has(r.id)}
                            onChange={() => toggle(r.id)}
                            aria-label={`Check in ${r.guest.name}`}
                            className="size-4 accent-primary cursor-pointer"
                          />
                        </td>
                        <td className="text-small text-primary-dark py-3 pr-4">
                          <GuestNameCell guest={r.guest} />
                        </td>
                        <td className="text-small text-primary-dark py-3 pr-4">{r.confirmationNumber}</td>
                        <td className="text-small text-primary-dark py-3 pr-4">{r.roomType.name}</td>
                        <td className="py-1">
                          {included.has(r.id) ? (
                            options.length === 0 && !room ? (
                              <span className="text-small text-red-600">No ready {r.roomType.name} room left</span>
                            ) : (
                              <Select
                                id={`group-room-${r.id}`}
                                name={`room-${r.id}`}
                                label={`Room for ${r.guest.name}`}
                                labelHidden
                                options={options}
                                value={room?.id ?? null}
                                onChange={(roomId) => setChosenRooms((prev) => ({ ...prev, [r.id]: roomId }))}
                              />
                            )
                          ) : (
                            <span className="text-small text-primary-dark/60">Later</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>

          <Section label="Billing">
            <label className="flex items-start gap-2 text-small text-primary-dark cursor-pointer">
              <input type="checkbox" className="size-4 mt-0.5 accent-primary cursor-pointer" checked={masterBill} onChange={(e) => setMasterBill(e.target.checked)} />
              <span>
                <span className="font-semibold">Bill the group&apos;s rooms to one master bill.</span> Every guest&apos;s room nights go on a bill on the lead guest&apos;s
                stay, for the group&apos;s organiser to pay; drinks, food and other extras stay on each guest&apos;s own bill.
              </span>
            </label>
            {masterBill ? (
              <Select
                id="group-lead"
                name="leadReservationId"
                label="Lead guest"
                options={group.arrivals.filter((r) => included.has(r.id)).map((r) => ({ value: r.id, label: `${r.guest.name} (${r.confirmationNumber})` }))}
                value={leadId}
                onChange={setLeadId}
                hint="The master bill opens on this guest's stay"
              />
            ) : null}
          </Section>

          <Button type="button" onClick={handleCheckIn} disabled={!canSubmit} loading={groupMutation.isPending} className="self-start">
            Check In {going.length} {going.length === 1 ? 'Guest' : 'Guests'}
          </Button>
        </>
      ) : null}
    </Container>
  );
}
