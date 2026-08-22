# Cards

Component: [`components/ui/Card.tsx`](../../components/ui/Card.tsx). Full
color math: `01-color.md`.

## The mechanic, in practice

`Card` has a `tone` prop (`primary | secondary | accent`) selecting *which*
brand color it's tinted with — but no `level` or `depth` prop. Visual
hierarchy comes purely from DOM nesting: put a `Card` inside a `Card` of the
same tone, and the two `/10`-opacity layers compound (see `01-color.md`'s
formula) into a visibly darker/richer fill, with zero extra markup or props
beyond just... nesting the component.

Each tone tints with its **dark-variant** hex (`primary-dark`, `secondary`,
`accent-dark`) rather than the base color — see `01-color.md`'s "Cards tint
with the dark variant, not the base color" for why (a real legibility bug,
not a style preference). Text placed directly on a `Card` should use
`text-secondary`, never `text-secondary-light`.

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

## Mixed-tone nesting

Nesting `Card`s of *different* tones is valid too (e.g. a `tone="primary"`
summary card containing a `tone="secondary"` detail card) — the compounding
math above is specific to same-tone nesting; a different tone underneath
just changes the base color the next layer's opacity blends against, rather
than compounding a single hue's opacity mathematically. Use same-tone
nesting when you want depth to read as "more of the same category," and
mixed-tone nesting when an inner element is a genuinely different kind of
content.
