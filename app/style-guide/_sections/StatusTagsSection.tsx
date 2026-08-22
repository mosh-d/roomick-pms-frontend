import { StatusTag, STATUS_STYLES, type StatusTagValue } from '@/components/ui/StatusTag';

// Generated from the component's own style map, not hand-listed — a future
// status added to STATUS_STYLES automatically appears here, so it can't be
// silently left out of the visual verification.
const ALL_VALUES = Object.keys(STATUS_STYLES) as StatusTagValue[];

export function StatusTagsSection() {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-header font-bold text-secondary">Status tags</h2>
      <p className="text-small text-secondary-light max-w-prose">
        Values match backend enum literals exactly. See lib/deriveRoomStatus.ts for how the composite room-status
        badge is derived from 3 backend columns.
      </p>
      <div className="flex flex-wrap gap-2">
        {ALL_VALUES.map((value) => (
          <StatusTag key={value} value={value} />
        ))}
      </div>
    </section>
  );
}
