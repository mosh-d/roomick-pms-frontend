# Color

Source of truth: [`tokens.css`](./tokens.css) (Tailwind utilities, e.g.
`bg-primary`) and [`tokens.ts`](./tokens.ts) (raw hex for JS contexts). Both
must stay in sync by hand.

## Base palette

| Token | Hex | Use |
|---|---|---|
| `primary` | `#CCA000` | Gold — primary buttons, VIP badge outline, focus rings, key accents |
| `primary-dark` | `#2E2400` | Deep bronze — rarely used directly |
| `primary-light` | `#FFF0B9` | Pale gold — tints, hover backgrounds on light surfaces |
| `secondary` | `#160029` | Near-black deep purple — default body text, secondary buttons |
| `secondary-light` | `#A698B2` | Muted lavender-gray — secondary text, subtle tints |
| `accent` | `#A1ABB2` | Cool slate — borders, disabled states, neutral chrome |
| `accent-dark` | `#3B444A` | Darker slate — stronger neutral chrome |
| `white` / `black` | pure | Tailwind's built-ins, not redeclared — see below |

`white`/`black` are intentionally **not** redeclared in `@theme` — Tailwind's
default palette already defines them as pure `#FFFFFF`/`#000000`, and this
token file is an *extension* of Tailwind's defaults, not a reset. Tailwind's
full default gray/red/etc. scale stays available alongside these (e.g.
`red-600` is used as the form error-state color — no brand error red was
specified, so we reuse Tailwind's default rather than inventing one).

## Accessibility extension: `primary-text`

Raw `primary` gold fails WCAG AA for text: measured against white, it's
~2.45:1 (the minimum for normal-size text is 4.5:1; even the relaxed
large-text/UI-component floor is 3:1, which raw gold is also short of by a
real margin). `#8C6D00` (`primary-text`) measures ~4.9:1 on white and is the
color used anywhere gold appears as *small text* — the Accent and Small
Accent typography roles (see `02-typography.md`), and the VIP badge's label
text.

Raw `primary` stays reserved for what the reference images actually show it
doing: large fills (primary buttons), badge backgrounds, borders, icons —
places where the 3:1 non-text/large-element threshold applies, or where
contrast is even less critical (a border, a focus ring).

## Status colors

The 8-token brand palette covers chrome and branding; a hotel PMS also needs
an *operational* color language for room and housekeeping state, which the
reference images show (5 room-status pills, 3 housekeeping pills, plus VIP)
without giving hex values. These are chosen to sit in the same
saturation/lightness family as the brand palette rather than reaching for
generic red/yellow/green:

| Token | Hex | Meaning |
|---|---|---|
| `status-vacant` | `#3F8F5C` (green) | Ready to sell |
| `status-occupied` | `#2E7D8C` (blue-teal) | Guest in house |
| `status-cleaning` | `#6B4A8A` (purple, same hue family as `secondary`) | Housekeeping in progress |
| `status-out-of-order` | `#9A5A2E` (rust) | Needs maintenance before it can be sold |
| `status-blocked` | = `accent-dark` | Administratively held, not a physical problem |
| `status-dirty` | = `status-out-of-order` | Same operational urgency as out-of-order |
| `status-clean` | = `status-occupied` | Same "occupiable" read as occupied |
| `status-inspected` | = `status-vacant` | Same "fully ready" read as vacant |

Several statuses **alias** an existing value rather than mint a new hex —
see `04-components/status-tags.md` for the reasoning behind each pairing.
VIP has no dedicated color token; its badge outline reuses `primary`
directly (see `04-components/status-tags.md`).

## The card-nesting mechanic

Roomick's card hierarchy comes from one rule: **every `Card`, at every
nesting depth, uses the identical opacity fill for its tone.** There is no
"level 1 card" / "level 2 card" token — depth alone produces the visual
hierarchy, because stacking N identical opacity layers of the same tint
doesn't add linearly, it *compounds* (alpha-over compositing):

```
effective_tint(N) = 1 − (1 − tint)^N
```

`secondary`/`accent` use a 10% base tint; `primary` is the one exception at
15% (see below for why):

| Nesting depth (N) | secondary / accent (10%) | primary (15%) |
|---|---|---|
| 1 | 10.0% | 15.0% |
| 2 | 19.0% | 27.8% |
| 3 | 27.1% | 38.6% |
| 4 | 34.4% | 47.8% |
| 5 | 41.0% | 55.6% |

The curve flattens out — each additional layer adds less than the one
before — which is why depth 1–3 is the practically useful range; beyond that
the visual difference between consecutive depths gets hard to perceive.
`components/ui/Card.tsx` has no `level` prop for exactly this reason: nest a
`Card` inside a `Card` and the math takes care of itself. The `/style-guide`
route's color section computes this same formula live (not hand-typed
percentages) so the demo can never drift from the number above.

### `secondary`/`accent` tint with the dark variant, not the base color

`secondary`/`accent` map to `secondary`/`accent-dark` — **not** raw
`accent` — even though `secondary` needs no separate dark variant (`#160029`
already is one). This was a real bug, not a stylistic choice: the first
version of this component tinted with the base colors, and at 4 levels of
nesting the compounded background converged on a pastel close enough in
perceived lightness to `text-secondary-light` that depth-4 text was nearly
invisible (caught visually in the `/style-guide` nesting demo). Dark-variant
bases converge on a visibly deeper tint instead, which stays reliably
legible under plain `text-secondary` (the app's default near-black body
text) at every practical nesting depth — **always use `text-secondary` for
text placed directly on a `Card`, never `text-secondary-light`.**

### `primary` is the one tone that doesn't follow that rule

`primary` uses `bg-primary-light/15 border-primary/40` instead of a
dark-variant/10 tint — the same pairing `Section` already uses for its own
background (see `04-components/cards.md`). Checked directly against the UI
reference, which renders a primary-toned highlight as a pale warm-gold box,
not a muddy tan — the dark-variant/10 formula (`bg-primary-dark/10`, an
earlier version of this token) didn't match it. `primary-light` (`#FFF0B9`)
is already pale, so diluting it to 10% over white is nearly invisible; 15%
is the minimum that reads clearly, which is why `primary`'s nesting math
uses a different base rate than `secondary`/`accent`. Accepted trade-off: a
primary-toned box is meant as a one-off highlight (matching `Section`), not
deep neutral hierarchy, so nesting it several levels deep isn't a real usage
pattern the way `secondary`/`accent` nesting is.
