# Cards

Component: [`components/ui/Card.tsx`](../../components/ui/Card.tsx). Full
color math: `01-color.md`.

## The mechanic, in practice

`Card` has a `tone` prop (`primary | secondary | accent`) selecting *which*
brand color it's tinted with — but no `level` or `depth` prop. Visual
hierarchy comes purely from DOM nesting: put a `Card` inside a `Card` of the
same tone, and the opacity layers compound (see `01-color.md`'s formula)
into a visibly darker/richer fill, with zero extra markup or props beyond
just... nesting the component.

`secondary`/`accent` tint with their **dark-variant** hex (`secondary`,
`accent-dark`) rather than the base color — see `01-color.md`'s "`secondary`/
`accent` tint with the dark variant, not the base color" for why (a real
legibility bug, not a style preference). `primary` is the one tone that
doesn't follow this: it uses `bg-primary-light/15 border-primary/40`,
reusing `Section`'s own pale-gold pairing, checked directly against the UI
reference (see `01-color.md`'s "`primary` is the one tone that doesn't
follow that rule" for the full reasoning and why it's a 15% base tint, not
10%). Text placed directly on a `Card` should use `text-secondary`, never
`text-secondary-light`.

```tsx
<Card tone="secondary">
  {/* one 10%-opacity secondary layer */}
  <Card tone="secondary">
    {/* a second, compounding to ~19% */}
  </Card>
</Card>
```

This is also why `Card` doesn't special-case "flat" vs. "nested" rendering —
there's nothing to special-case. A `Card` at the top of a tree and a `Card`
three levels deep are the exact same component with the exact same props;
only their position in the DOM differs.

## Tone selection

Corrected after reviewing the actual product reference closely (an earlier
version of this doc claimed a strict accent-vs-primary split by
interactivity that the reference doesn't actually support):

- **`tone="secondary"` is the default, general-purpose nested-content
  tone** — used for both interactive sub-content (a `Select` in its open
  state, a nested form) and plain read-only detail snippets (a Name/Email/
  Phone summary card) *within a working page*. The reference doesn't
  distinguish these by color; it distinguishes them by context/position.
- **`primary`/`primary-light` is reserved for `Section` wrappers**
  (see `layout-patterns.md`) **and whole-page Review/Summary contexts**
  (the onboarding wizard's dedicated "Review" step, where every detail row
  — including read-only ones — sits in a primary-light box). Never use
  `primary` for an ordinary nested content card inside a `Section` — that's
  the "mixing colors" mistake `Section` exists to prevent.
- **`accent`** stays available for a more muted/neutral look than
  `secondary` where wanted, but isn't governed by a strict interactive/
  non-interactive rule.

`BrandRadioCard`'s selected state uses `tone="secondary"` (not primary) for
exactly this reason — see `forms.md`.

## Solid primary panels (navigation) are a different pattern

The reference navigation panel (a "Check-In" section listing Arrivals
Dashboard / Check-In Flow / Walk-In Booking as pill buttons) uses a
**solid, full-opacity** primary background with white text and white pill
buttons — this is *not* an instance of `Card`'s translucent `/10` tint
mechanic, and not the same as `Section`'s translucent `primary-light`
either. `Card`/`Section` are for tinted content surfaces; a solid primary
panel is specifically for navigation chrome. No navigation component exists
yet (next phase) — noted here so it isn't accidentally built as a `Card`
or `Section` with a solid override.

## Mixed-tone nesting

Nesting `Card`s of *different* tones is valid too (e.g. a `tone="primary"`
summary card containing a `tone="secondary"` detail card) — the compounding
math above is specific to same-tone nesting; a different tone underneath
just changes the base color the next layer's opacity blends against, rather
than compounding a single hue's opacity mathematically. Use same-tone
nesting when you want depth to read as "more of the same category," and
mixed-tone nesting when an inner element is a genuinely different kind of
content.
