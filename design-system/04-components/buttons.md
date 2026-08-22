# Buttons

Component: [`components/ui/Button.tsx`](../../components/ui/Button.tsx).

## Variants

Mapped directly to the reference image's 3-column × 3-row grid (column =
variant, row = default/hover/disabled):

| Variant | Default | Hover | Disabled |
|---|---|---|---|
| `primary` | `bg-primary text-secondary` | `hover:brightness-110` | `opacity-50` |
| `secondary` | `bg-secondary text-white` | `hover:brightness-125` | `opacity-50` |
| `outline` (`tone: onLight\|onDark`) | bordered, transparent fill | inverts to a solid fill | muted (`border-accent text-accent`) |

## Decisions worth knowing

- **Primary button text is `text-secondary`, not white.** White-on-`#CCA000`
  measures ~2.45:1 (fails WCAG AA); `secondary`-on-`primary` measures ~8:1.
  Gold + deep purple is also a stronger on-brand pairing than gold + white.
- **Sentence case, not the uppercase-tracked style Daddy Bear uses.**
  `uppercase tracking-wide` is a marketing-CTA convention; Roomick's
  "efficient over decorative" voice (`00-brand-voice.md`) calls for labels
  that scan faster — "Check In", not "CHECK IN".
- **Hover uses `brightness()`, not a second color token.** A
  brightness-filter hover is surface-agnostic — it looks the same
  regardless of what's rendered behind or around the button. An
  opacity-over-background hover would visually shift depending on that
  background, which a fixed color token can't account for.
- **`outline`'s disabled state reuses `accent`**, not a dimmed version of
  black — matching the reference image's visibly muted-gray disabled row
  with zero new hex values.

## Shape and sizing

- `rounded-control` (not `rounded-pill` — see `03-spacing-layout.md` for
  why), `min-h-11` (44px, the accessible minimum tap target) even at the
  denser `size="sm"` used for inline table-row actions.
- `focus-visible:ring-2 ring-primary ring-offset-2` — always present, never
  `outline-none` without a replacement.
- `loading` prop replaces the label with a spinner (`Icons.tsx`'s
  `SpinnerIcon`) and implicitly disables the button.

## Never more than one primary per section

Same rule Daddy Bear states for its own primary button, worth repeating
here: a screen full of gold `primary` buttons defeats the point of having a
high-emphasis variant at all. One primary action per section; everything
else is `secondary` or `outline`.
