'use client';

import { Select, type SelectOption } from '@/components/ui/Select';
import { STATUS_STYLES } from '@/components/ui/StatusTag';
import type { CompositeRoomStatus } from '@/lib/deriveRoomStatus';

const ALL_VALUE = '';

// The 5-state composite badge only (see deriveRoomStatus.ts) — not the raw
// cleanliness sub-states (dirty/clean/inspected), which don't appear on
// this glance-view grid at all.
const STATUS_OPTIONS: SelectOption[] = [
  { value: ALL_VALUE, label: 'All statuses' },
  ...(['vacant', 'occupied', 'cleaning', 'out_of_order', 'blocked'] satisfies CompositeRoomStatus[]).map((value) => ({
    value,
    label: STATUS_STYLES[value].label,
  })),
];

export interface RoomStatusFiltersValue {
  status: CompositeRoomStatus | '';
  buildingId: string;
  roomTypeId: string;
}

/**
 * Reference page 19's filter row (Room Status / Building / Room Category +
 * "Filters (N)" / "Clear all") — collapsed to plain `Select`s rather than
 * the reference's separate popover-badge treatment, since this app's own
 * `Select` already reads its current value inline (no need for a second
 * "Filters (1)" summary chip next to it).
 */
export function RoomStatusFilters({
  value,
  onChange,
  buildingOptions,
  roomTypeOptions,
}: {
  value: RoomStatusFiltersValue;
  onChange: (value: RoomStatusFiltersValue) => void;
  buildingOptions: SelectOption[];
  roomTypeOptions: SelectOption[];
}) {
  const activeCount = [value.status, value.buildingId, value.roomTypeId].filter((v) => v !== ALL_VALUE).length;

  return (
    <div className="flex flex-wrap items-start gap-4">
      <div className="w-48">
        <Select
          id="room-status-filter"
          label="Room Status"
          options={STATUS_OPTIONS}
          value={value.status}
          onChange={(status) => onChange({ ...value, status: status as CompositeRoomStatus | '' })}
        />
      </div>
      {buildingOptions.length > 1 ? (
        <div className="w-48">
          <Select
            id="building-filter"
            label="Building"
            options={[{ value: ALL_VALUE, label: 'All buildings' }, ...buildingOptions]}
            value={value.buildingId}
            onChange={(buildingId) => onChange({ ...value, buildingId })}
          />
        </div>
      ) : null}
      <div className="w-48">
        <Select
          id="room-category-filter"
          label="Room Category"
          options={[{ value: ALL_VALUE, label: 'All categories' }, ...roomTypeOptions]}
          value={value.roomTypeId}
          onChange={(roomTypeId) => onChange({ ...value, roomTypeId })}
        />
      </div>
      {activeCount > 0 ? (
        // A same-size invisible label above the button mirrors each
        // `Select`'s own label-then-input stack, so this lines up with
        // their input row under `items-start` instead of needing a
        // hand-tuned margin that would drift out of sync with Select's own
        // spacing.
        <div className="flex flex-col gap-1 py-2">
          <span aria-hidden className="text-small invisible">
            Clear
          </span>
          <button
            type="button"
            onClick={() => onChange({ status: ALL_VALUE, buildingId: ALL_VALUE, roomTypeId: ALL_VALUE })}
            className="text-small font-semibold text-secondary underline hover:text-secondary-light cursor-pointer"
          >
            Clear all ({activeCount})
          </button>
        </div>
      ) : null}
    </div>
  );
}
