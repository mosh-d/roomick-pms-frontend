# Status tags

Components: [`components/ui/StatusTag.tsx`](../../components/ui/StatusTag.tsx),
[`lib/deriveRoomStatus.ts`](../../lib/deriveRoomStatus.ts).

## The 9 states

| Value | Label | Fill | Group |
|---|---|---|---|
| `vacant` | Vacant | `status-vacant` (green) | Composite room status |
| `occupied` | Occupied | `status-occupied` (blue-teal) | Composite room status |
| `cleaning` | Cleaning | `status-cleaning` (purple) | Composite room status *and* Cleanliness |
| `out_of_order` | Out Of Order | `status-out-of-order` (rust) | Composite room status |
| `blocked` | Blocked | `status-blocked` (= accent-dark) | Composite room status |
| `dirty` | Dirty | `status-dirty` (= out-of-order rust) | Cleanliness |
| `clean` | Clean | `status-clean` (= occupied blue-teal) | Cleanliness |
| `inspected` | Inspected | `status-inspected` (= vacant green) | Cleanliness |
| `vip` | VIP | outline only, `primary` gold | Decorative |

Values are literal backend enum strings (`out_of_order`, not `outOfOrder`) —
this is deliberate, so a future API response can be passed straight into
`<StatusTag value={room.status} />` with no translation layer to keep in
sync as the backend evolves.

## Why the room-status badge needs a derivation helper

The backend (`roomick-pms-backend/prisma/schema.prisma`) models a room's
state as **three independent columns**, not one:

```
OccupancyStatus   'vacant' | 'occupied'
CleanlinessStatus 'dirty' | 'cleaning' | 'clean' | 'inspected'
HeldStatus        'out_of_order' | 'blocked' | null
```

But the reference image's room-grid badge is **one** color with 5 possible
values — a composite that has to prioritize which of the three columns wins
when they disagree (a room can be simultaneously `vacant`, `clean`, and NOT
held — or `occupied`, `dirty`, and held for maintenance). `lib/
deriveRoomStatus.ts` is the single place that priority order lives:

```
held (if set) > cleanliness === 'cleaning' > occupancy
```

Duplicating this logic ad hoc in every component that renders a room badge
is exactly the "two systems independently tracking the same fact, drifting
apart" bug class documented in the sibling `five-clover-nestjs-backend`
project's `docs/LESSONS-LEARNED.md` §4 — their own room-status priority
order was once wrong in one of two places that computed it, and a stale
hold outranked a guest standing in the room. **Always import
`deriveRoomStatus`; never re-derive the priority order locally.** If a
future API response exposes a server-computed status field directly, delete
this helper and consume that field instead.

## The VIP contrast trade-off (documented, not accidental)

The reference image specifies gold text on a transparent/outline background
for the VIP badge — measuring ~2.45:1, which fails WCAG AA for text. This is
kept as specified, unlike every other status here (all white-on-fill at
≥4.5:1), because VIP is a **decorative label**, not an operational state a
front-desk agent's safety depends on reading correctly at a glance. If
strict AA compliance is ever required for it, two options that don't change
the token: bump to `font-bold` + a larger size (moves it toward the relaxed
3:1 large-text threshold), or add a `bg-primary/10` fill behind the outline
to raise effective contrast without changing the border/text color.
