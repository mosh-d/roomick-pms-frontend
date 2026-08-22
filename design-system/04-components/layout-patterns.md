# Layout patterns

Components: `Section`, `EntryCard`, `FeatureCard` (all in
[`components/ui/`](../../components/ui/)). Grounded directly in the actual
product reference (`Roomick PMS/references/Roomick-UI.pdf`), reviewed page
by page — these three patterns recur across nearly every screen in it.

## `Section` — the primary page-structure pattern

A small-caps gold label + horizontal rule, above a pale, thin-gold-bordered
box (`bg-primary-light/15 border border-primary/40 rounded-card`). This is
the **only** place `primary-light` appears as a background in the whole
system, reserved for section-level content grouping — e.g. "EARLY
CHECK-IN", "GUEST DETAILS", "RESERVATION DETAILS", "ID CAPTURE" in the
Check-In Flow reference.

**Nothing nested inside a `Section` uses `primary`/`primary-light` again** —
that's the "mixing colors" mistake this pattern exists to prevent (see
`01-color.md`). Interactive content nested inside a Section uses `Card`'s
secondary/gray tone instead; RadioCard's plain-radio-row default (no
`description`) is what the reference actually uses for every top-level
either/or choice inside a Section (Early Check-In Surcharge, Digital/Manual
Capture, Fixed/Percentage Rate — see `forms.md`'s `RadioCard` note), not a
second described-card layer.

**Not the same thing as a solid primary navigation panel** — a separate,
not-yet-built pattern (see the reference's "Check-In" sidebar nav group:
full-opacity primary background, white text, white pill buttons). `Section`
is a translucent content-grouping tint with dark text; a nav panel is solid
chrome with white text. Don't reach for `Section` when that pattern
eventually gets built.

## `EntryCard` — titled, removable, repeatable entries

The pattern behind "Rule 1"/"Rule 2" (Tax Rule Builder), "Staff 1"/
"Staff 2" (Staff Invite), "Building 1"/"Building 2" (Branch Setup),
"Room Type 1"/"Room Type 2", "Cost 1"/"Cost 2" (Additional Costs) —
anywhere the reference lets a user add multiple instances of something and
remove any one of them individually. Bold title + `×` remove button in a
header row, content below.

Tinted with `Card`'s secondary opacity fill (`CARD_TONE_CLASSES.secondary`,
imported not hand-copied) — it's a nested content surface inside a
`Section` like any other, so it follows the same "secondary, not primary
again" rule as everything else nested there.

## `FeatureCard` — clickable navigation/summary tiles

The pattern behind the Front Desk hub's "Arrivals Dashboard" / "Check-In
Flow" / "Room Status Board" cards: icon + bold title, one underlined
description line, then a few muted stat lines ("12 pending arrivals
today"). Unlike `Card` (a passive content surface), a `FeatureCard` is
always interactive and always navigates somewhere — it renders as a real
`<Link>` when given `href` (or a `<button>` when given `onClick` instead),
never a `<div>` with a click handler bolted on. Uses `Card`'s
`secondary`-family tint (`bg-secondary/10`).

No real icon set exists yet for this pattern (the reference uses simple
line icons — airplane, building, person-walking — none of which are in
`Icons.tsx`); the `/style-guide` demo reuses existing icons as
placeholders. A real icon set is future work once real hub pages are
built.
