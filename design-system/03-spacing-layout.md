# Spacing & layout

## Scale

Tailwind's default 4px base scale, used as-is — no custom spacing tokens.
Reaching for a non-default value is a signal to reconsider the layout rather
than add one-off CSS.

## Containers

`Container` (`components/ui/Container.tsx`): `max-w-screen-2xl mx-auto px-4
sm:px-6 lg:px-8`. This is deliberately wider than a typical marketing-site
reading-width container (Daddy Bear's is `max-w-6xl`, ~72rem) — room grids
and data tables need the horizontal room a prose-width column doesn't give
them.

## Breakpoints

Default Tailwind breakpoints (`sm` 640px, `md` 768px, `lg` 1024px, `xl`
1280px). Unlike Daddy Bear's strict phone-first mandate (its actual audience
is someone scrolling on a phone), Roomick's primary target is a **tablet or
desktop at a front desk or back office** — design for that first, and make
sure it degrades sensibly down to phone for an on-the-go manager checking in
from their own device, rather than building phone-up.

## Radii — three tiers, not one

| Token | Value | Use |
|---|---|---|
| `radius-control` | `0.5rem` | Buttons, inputs, selects, textareas, chips |
| `radius-card` | `0.5rem` | Cards, panels, dropzones, fieldsets — reduced twice per design review, now level with `radius-control` |
| `radius-pill` | `999px` | Badges/status tags, and the Yes/No toggle only |

The reference images never show a button as a full pill — only badges are
pills. A dense operational tool reads as a *control*, not a marketing CTA,
so buttons get the smaller control radius rather than reusing the pill
radius the way a landing-site button often would.

## Section rhythm

Roomick doesn't yet have a page-rhythm concept to document (no app shell,
no marketing-style alternating sections) — that's `04-components/
navigation.md`'s job once an authenticated layout exists, deliberately not
built this pass. For now: components space themselves with `gap-4`/`gap-6`
depending on density, and dense data views (tables, grids) can go tighter
than that.
