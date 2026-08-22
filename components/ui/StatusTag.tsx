export type StatusTagValue =
  // Composite room status (see lib/deriveRoomStatus.ts) — 5 states.
  | 'vacant'
  | 'occupied'
  | 'cleaning'
  | 'out_of_order'
  | 'blocked'
  // CleanlinessStatus, shown directly on the housekeeping board — 4 states.
  // 'cleaning' is shared with the composite group above (same visual
  // meaning, same color) rather than duplicated.
  | 'dirty'
  | 'clean'
  | 'inspected'
  // Decorative, not operational.
  | 'vip';

// Values are literal backend enum strings (out_of_order, not outOfOrder) on
// purpose — this lets a future API response be passed straight into
// `<StatusTag value={room.status} />` with no translation layer to keep in
// sync.
const STATUS_STYLES: Record<StatusTagValue, { label: string; className: string }> = {
  vacant: { label: 'Vacant', className: 'bg-status-vacant' },
  occupied: { label: 'Occupied', className: 'bg-status-occupied' },
  cleaning: { label: 'Cleaning', className: 'bg-status-cleaning' },
  out_of_order: { label: 'Out Of Order', className: 'bg-status-out-of-order' },
  blocked: { label: 'Blocked', className: 'bg-status-blocked' },
  dirty: { label: 'Dirty', className: 'bg-status-dirty' },
  clean: { label: 'Clean', className: 'bg-status-clean' },
  inspected: { label: 'Inspected', className: 'bg-status-inspected' },
  // Outline, not solid: VIP is a decorative label, not an operational
  // state, so it doesn't need the ≥4.5:1 white-on-fill contrast the other
  // 8 states guarantee. It reuses raw --color-primary directly (gold
  // border + gold text on transparent) exactly as the reference image
  // shows, even though gold-on-white text alone measures ~2.45:1 — a
  // documented, accepted trade-off for a non-operational label. See
  // design-system/04-components/status-tags.md.
  vip: { label: 'VIP', className: 'border border-primary text-primary bg-transparent' },
};

export function StatusTag({ value, className = '' }: { value: StatusTagValue; className?: string }) {
  const style = STATUS_STYLES[value];
  const isOutline = value === 'vip';
  return (
    <span
      className={`inline-flex items-center rounded-pill px-3 py-1 text-small font-semibold ${
        isOutline ? '' : 'text-white'
      } ${style.className} ${className}`}
    >
      {style.label}
    </span>
  );
}

export { STATUS_STYLES };
