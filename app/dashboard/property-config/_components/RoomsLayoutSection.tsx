'use client';

import { useMemo, useState } from 'react';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ApiError } from '@/lib/api';
import { expandRoomNumbers, useLayoutChangeMutation, useLayoutQuery, type LayoutBuilding, type LayoutChange } from '@/lib/layout';
import { useRoomsQuery, useRoomTypesQuery, type RoomWithDetails } from '@/lib/rooms';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

type Dialog =
  | { kind: 'addRooms'; floorId?: string }
  | { kind: 'addBuilding' }
  | { kind: 'renameBuilding'; building: LayoutBuilding }
  | { kind: 'addFloor'; buildingId: string }
  | { kind: 'editFloor'; floor: LayoutBuilding['floors'][number] }
  | { kind: 'editRoom'; room: RoomWithDetails };

function floorName(floor: { floorNumber: number; label: string | null }): string {
  return floor.label ?? (floor.floorNumber === 0 ? 'Ground floor' : `Floor ${floor.floorNumber}`);
}

/**
 * Rooms & Layout — the property's buildings, floors and rooms after
 * onboarding: add rooms (a renovation, a new wing), renumber one, change a
 * room's type, move it to another floor, take it out of the inventory, and
 * name buildings and floors. The backend refuses what would hurt a guest: a
 * type change or removal while someone is in the room, or one that would
 * leave a room type short for a night it has bookings for. A removed room's
 * number, added again, brings that room back.
 */
export function RoomsLayoutSection({ branchId, auth }: { branchId: string; auth: AuthOpts }) {
  const layoutQuery = useLayoutQuery(branchId, auth);
  const roomsQuery = useRoomsQuery(branchId, auth);
  const roomTypesQuery = useRoomTypesQuery(branchId, auth);
  const changeMutation = useLayoutChangeMutation(branchId, auth);
  const [dialog, setDialogState] = useState<Dialog | null>(null);
  const [removing, setRemoving] = useState<RoomWithDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const buildings = useMemo(() => layoutQuery.data ?? [], [layoutQuery.data]);
  const roomsByFloor = useMemo(() => {
    const map = new Map<string, RoomWithDetails[]>();
    for (const room of roomsQuery.data ?? []) map.set(room.floor.id, [...(map.get(room.floor.id) ?? []), room]);
    for (const list of map.values()) list.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
    return map;
  }, [roomsQuery.data]);
  const floorOptions: SelectOption[] = buildings.flatMap((b) => b.floors.map((f) => ({ value: f.id, label: `${b.name ?? 'Main building'} · ${floorName(f)}` })));
  const typeOptions: SelectOption[] = (roomTypesQuery.data ?? []).map((t) => ({ value: t.id, label: t.name }));

  /** Opening or closing a dialog starts it without the last attempt's error. */
  function setDialog(next: Dialog | null) {
    setError(null);
    setDialogState(next);
  }

  async function run(change: LayoutChange, done: string) {
    setError(null);
    setNotice(null);
    try {
      await changeMutation.mutateAsync(change);
      setNotice(done);
      setDialogState(null);
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
      return false;
    }
  }

  return (
    <Section label="Rooms & Layout">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-small text-surface-muted max-w-xl">Buildings, floors and rooms. Select a room to renumber it, change its type or floor, or take it out of the inventory.</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setDialog({ kind: 'addBuilding' })}>
            Add Building
          </Button>
          <Button size="sm" onClick={() => setDialog({ kind: 'addRooms' })} disabled={floorOptions.length === 0}>
            Add Rooms
          </Button>
        </div>
      </div>
      {error && !dialog ? <p className="text-small text-red-600">{error}</p> : null}
      {notice ? <p className="text-small text-green-700">{notice}</p> : null}

      {layoutQuery.isLoading || roomsQuery.isLoading ? (
        <p className="text-body text-surface-muted">Loading the layout…</p>
      ) : buildings.length === 0 ? (
        <p className="text-body text-surface-muted">No buildings yet — add one, then its floors and rooms.</p>
      ) : (
        buildings.map((building) => (
          <Card key={building.id} tone="secondary" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-body font-bold text-surface">{building.name ?? 'Main building'}</h3>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setDialog({ kind: 'renameBuilding', building })}>
                  {building.name ? 'Rename' : 'Name it'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setDialog({ kind: 'addFloor', buildingId: building.id })}>
                  Add Floor
                </Button>
              </div>
            </div>
            {building.floors.length === 0 ? (
              <p className="text-small text-surface-muted">No floors yet.</p>
            ) : (
              building.floors.map((floor) => {
                const rooms = roomsByFloor.get(floor.id) ?? [];
                return (
                  <div key={floor.id} className="flex flex-col gap-2 border-t border-secondary/15 pt-3 first:border-0 first:pt-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-small font-semibold text-surface">
                        {floorName(floor)} <span className="font-normal text-surface-muted">· {rooms.length} {rooms.length === 1 ? 'room' : 'rooms'}</span>
                      </span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setDialog({ kind: 'editFloor', floor })}>
                          Edit Floor
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setDialog({ kind: 'addRooms', floorId: floor.id })}>
                          Add Rooms Here
                        </Button>
                      </div>
                    </div>
                    {rooms.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {rooms.map((room) => (
                          <button
                            key={room.id}
                            type="button"
                            onClick={() => setDialog({ kind: 'editRoom', room })}
                            className="flex flex-col items-start rounded-control border border-secondary/20 px-3 py-1.5 text-left hover:bg-secondary/5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            aria-label={`Room ${room.number}, ${room.roomType.name} — edit`}
                          >
                            <span className="text-small font-semibold text-surface">{room.number}</span>
                            <span className="text-tiny text-surface-muted">{room.roomType.name}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </Card>
        ))
      )}

      {dialog?.kind === 'addRooms' ? (
        <AddRoomsDialog
          error={error}
          floorOptions={floorOptions}
          typeOptions={typeOptions}
          initialFloorId={dialog.floorId}
          pending={changeMutation.isPending}
          onClose={() => setDialog(null)}
          onSave={(change, count) => run(change, `Added ${count} ${count === 1 ? 'room' : 'rooms'}.`)}
        />
      ) : null}
      {dialog?.kind === 'addBuilding' || dialog?.kind === 'renameBuilding' ? (
        <NameDialog
          error={error}
          title={dialog.kind === 'addBuilding' ? 'Add a building' : 'Name this building'}
          label="Building name"
          initial={dialog.kind === 'renameBuilding' ? (dialog.building.name ?? '') : ''}
          pending={changeMutation.isPending}
          onClose={() => setDialog(null)}
          onSave={(name) =>
            dialog.kind === 'addBuilding'
              ? run({ kind: 'addBuilding', name }, `Added ${name}.`)
              : run({ kind: 'renameBuilding', buildingId: dialog.building.id, name }, `Renamed to ${name}.`)
          }
        />
      ) : null}
      {dialog?.kind === 'addFloor' || dialog?.kind === 'editFloor' ? (
        <FloorDialog
          error={error}
          initial={dialog.kind === 'editFloor' ? dialog.floor : null}
          pending={changeMutation.isPending}
          onClose={() => setDialog(null)}
          onSave={(floorNumber, label) =>
            dialog.kind === 'addFloor'
              ? run({ kind: 'addFloor', buildingId: dialog.buildingId, floorNumber, label: label || undefined }, 'Floor added.')
              : run({ kind: 'updateFloor', floorId: dialog.floor.id, floorNumber, label }, 'Floor updated.')
          }
        />
      ) : null}
      {dialog?.kind === 'editRoom' ? (
        <RoomDialog
          error={error}
          room={dialog.room}
          floorOptions={floorOptions}
          typeOptions={typeOptions}
          pending={changeMutation.isPending}
          onClose={() => setDialog(null)}
          onRemove={() => {
            setRemoving(dialog.room);
            setDialog(null);
          }}
          onSave={(change) => run(change, `Room ${change.number ?? dialog.room.number} saved.`)}
        />
      ) : null}
      <ConfirmDialog
        open={removing !== null}
        title={`Take room ${removing?.number ?? ''} out of the inventory?`}
        description="It won't be sold or offered at check-in any more. Its history stays, and adding its number again brings it back."
        confirmLabel="Remove Room"
        onCancel={() => setRemoving(null)}
        loading={changeMutation.isPending}
        onConfirm={async () => {
          const room = removing;
          if (room) await run({ kind: 'removeRoom', roomId: room.id }, `Room ${room.number} removed.`);
          setRemoving(null);
        }}
      />
    </Section>
  );
}

function AddRoomsDialog({
  error,
  floorOptions,
  typeOptions,
  initialFloorId,
  pending,
  onClose,
  onSave,
}: {
  floorOptions: SelectOption[];
  typeOptions: SelectOption[];
  initialFloorId?: string;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (change: LayoutChange, count: number) => Promise<boolean>;
}) {
  const [floorId, setFloorId] = useState<string | null>(initialFloorId ?? floorOptions[0]?.value ?? null);
  const [roomTypeId, setRoomTypeId] = useState<string | null>(typeOptions[0]?.value ?? null);
  const [numbers, setNumbers] = useState('');
  const [view, setView] = useState('');
  const expanded = expandRoomNumbers(numbers);
  const ready = Boolean(floorId && roomTypeId && expanded.numbers.length > 0 && !expanded.error);
  return (
    <Modal open onClose={onClose} title="Add rooms">
      <Select id="add-rooms-floor" name="floorId" label="Floor" options={floorOptions} value={floorId} onChange={setFloorId} />
      <Select id="add-rooms-type" name="roomTypeId" label="Room type" options={typeOptions} value={roomTypeId} onChange={setRoomTypeId} />
      <Input name="roomNumbers" label="Room numbers" value={numbers} onChange={(e) => setNumbers(e.target.value)} placeholder="301-310, 312, PH-A" hint="Ranges and single numbers, separated by commas" />
      {expanded.error ? (
        <p className="text-small text-red-600">{expanded.error}</p>
      ) : expanded.numbers.length > 0 ? (
        <p className="text-small text-surface-muted">
          {expanded.numbers.length} {expanded.numbers.length === 1 ? 'room' : 'rooms'}: {expanded.numbers.slice(0, 12).join(', ')}
          {expanded.numbers.length > 12 ? '…' : ''}
        </p>
      ) : null}
      <Input name="roomView" label="View (optional)" value={view} onChange={(e) => setView(e.target.value)} maxLength={50} />
      {error ? <p className="text-small text-red-600">{error}</p> : null}
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={!ready}
          loading={pending}
          onClick={() =>
            floorId && roomTypeId
              ? void onSave({ kind: 'addRooms', floorId, roomTypeId, numbers: expanded.numbers, view: view.trim() || undefined }, expanded.numbers.length)
              : undefined
          }
        >
          Add Rooms
        </Button>
      </div>
    </Modal>
  );
}

function NameDialog({
  error,
  title,
  label,
  initial,
  pending,
  onClose,
  onSave,
}: {
  title: string;
  label: string;
  initial: string;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (name: string) => Promise<boolean>;
}) {
  const [name, setName] = useState(initial);
  return (
    <Modal open onClose={onClose} title={title}>
      <Input name="layoutName" label={label} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
      {error ? <p className="text-small text-red-600">{error}</p> : null}
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" disabled={!name.trim()} loading={pending} onClick={() => void onSave(name.trim())}>
          Save
        </Button>
      </div>
    </Modal>
  );
}

function FloorDialog({
  error,
  initial,
  pending,
  onClose,
  onSave,
}: {
  initial: { floorNumber: number; label: string | null } | null;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (floorNumber: number, label: string) => Promise<boolean>;
}) {
  const [floorNumber, setFloorNumber] = useState(initial ? String(initial.floorNumber) : '');
  const [label, setLabel] = useState(initial?.label ?? '');
  const valid = /^\d+$/.test(floorNumber.trim());
  return (
    <Modal open onClose={onClose} title={initial ? 'Edit floor' : 'Add a floor'}>
      <Input name="floorNumber" label="Floor number" type="number" min={0} value={floorNumber} onChange={(e) => setFloorNumber(e.target.value)} hint="0 is the ground floor" />
      <Input name="floorLabel" label="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={30} placeholder="e.g. Mezzanine" />
      {error ? <p className="text-small text-red-600">{error}</p> : null}
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" disabled={!valid} loading={pending} onClick={() => void onSave(Number(floorNumber.trim()), label.trim())}>
          Save
        </Button>
      </div>
    </Modal>
  );
}

function RoomDialog({
  error,
  room,
  floorOptions,
  typeOptions,
  pending,
  onClose,
  onRemove,
  onSave,
}: {
  room: RoomWithDetails;
  floorOptions: SelectOption[];
  typeOptions: SelectOption[];
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onRemove: () => void;
  onSave: (change: Extract<LayoutChange, { kind: 'updateRoom' }>) => Promise<boolean>;
}) {
  const [number, setNumber] = useState(room.number);
  const [roomTypeId, setRoomTypeId] = useState<string | null>(room.roomType.id);
  const [floorId, setFloorId] = useState<string | null>(room.floor.id);
  const [view, setView] = useState(room.view ?? '');
  const [notes, setNotes] = useState(room.notes ?? '');
  const occupied = room.occupancyStatus === 'occupied';
  return (
    <Modal open onClose={onClose} title={`Room ${room.number}`}>
      <Input name="roomNumber" label="Room number" value={number} onChange={(e) => setNumber(e.target.value)} maxLength={20} />
      <Select
        id="edit-room-type"
        name="roomTypeId"
        label="Room type"
        options={typeOptions}
        value={roomTypeId}
        onChange={setRoomTypeId}
        disabled={occupied}
        hint={occupied ? 'A guest is in this room — move them first' : undefined}
      />
      <Select id="edit-room-floor" name="floorId" label="Floor" options={floorOptions} value={floorId} onChange={setFloorId} />
      <Input name="roomViewEdit" label="View (optional)" value={view} onChange={(e) => setView(e.target.value)} maxLength={50} />
      <Input name="roomNotes" label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
      {error ? <p className="text-small text-red-600">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={!number.trim()}
          loading={pending}
          onClick={() =>
            void onSave({
              kind: 'updateRoom',
              roomId: room.id,
              number: number.trim() !== room.number ? number.trim() : undefined,
              roomTypeId: roomTypeId && roomTypeId !== room.roomType.id ? roomTypeId : undefined,
              floorId: floorId && floorId !== room.floor.id ? floorId : undefined,
              view: view.trim() !== (room.view ?? '') ? view.trim() : undefined,
              notes: notes.trim() !== (room.notes ?? '') ? notes.trim() : undefined,
            })
          }
        >
          Save Room
        </Button>
        <Button type="button" variant="danger" onClick={onRemove} disabled={occupied}>
          Remove Room
        </Button>
      </div>
    </Modal>
  );
}
