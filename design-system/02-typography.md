# Typography

## Pairing

- **Body / UI — Satoshi** (`font-body`). Default for all 9 type-scale roles
  below. Self-hosted via `next/font/local` (Satoshi isn't on Google Fonts —
  it's distributed by Fontshare, licensed for self-hosting; see
  `lib/fonts.ts`). This is a dense operational tool, not a marketing site —
  a single consistent sans throughout matters more here than serif
  flourish, so Satoshi is the default everywhere, including headings.
- **Display / occasional accent — Playfair Display** (`font-display`).
  Self-hosted automatically via `next/font/google`. Opt-in only, layered
  onto the Header/Title/Emphasis roles (≥18px) for a small set of future
  brand moments (an auth screen, an empty state) — **never** below
  `text-header`, mirroring the same "display serif loses legibility at
  small sizes" rule Daddy Bear's own typography doc states.

## Scale

The brand spec's Figma text-styles panel lists 9 roles but only 6 *distinct*
size/line-height pairs — several roles are metrically identical and differ
only in color or weight. Rather than mint duplicate tokens for identical
metrics, `tokens.css` defines one token per unique pair, and the semantic
difference is composed at the call site (see `components/ui/Text.tsx`,
which encodes this exact mapping so it's never re-derived ad hoc):

| Role | Size/Line-height | Token | Composition |
|---|---|---|---|
| Title | 32/34 | `text-title` | — |
| Emphasis | 32/34, bold-only | `text-title` | `+ font-bold` (always, no regular variant) |
| Header | 18/20 | `text-header` | — |
| Sub-header | 16/18 | `text-subheader` | — |
| Body | 14/16 | `text-body` | — |
| Accent | 14/16 | `text-body` | `+ text-primary-text` (gold) |
| Small | 12/14 | `text-small` | — |
| Small Accent | 12/14 | `text-small` | `+ text-primary-text` (gold) |
| Tiny | 11/13 | `text-tiny` | — |

Every role except Emphasis is available in Regular (`font-normal`) and Bold
(`font-weight-bold`) — composed via the `bold` prop on `Text`, not a
separate weight token.

## Rules

1. Never use `font-display` (Playfair Display) below `text-header` — it
   loses legibility at small sizes, exactly the accessibility floor Daddy
   Bear's own type doc draws the same line at.
2. **Emphasis is reserved for one hero metric per screen** — e.g. today's
   occupancy percentage on a dashboard — never for body copy or a second
   competing number on the same screen. Treat it like a primary button:
   at most one per view.
3. Don't reach for a size outside this scale. If something needs to be
   bigger or smaller than `text-title`/`text-tiny`, that's a signal to
   reconsider the layout (e.g. split into two screens) rather than add a
   one-off font-size.
