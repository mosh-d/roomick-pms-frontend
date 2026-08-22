# Brand voice

## The rule

Roomick reads as **efficient, dense, and legible at a glance**. Every screen
should work for a front-desk agent checking a guest in with a line forming
behind them, or a housekeeper glancing at a tablet between rooms — not for
someone with time to admire it.

In practice:

- **Information density over whitespace.** A room grid, a folio, a
  reservation list — these need to show a lot at once. Generous marketing-
  site padding is the wrong instinct here; pack information tightly while
  keeping it scannable.
- **One-handed, on a tablet, at a counter.** Every interactive control has a
  real (≥44px) tap target. Nothing depends on hover-only affordances or a
  precise mouse click.
- **State is color, not prose.** A room's status, a folio's balance state, a
  reservation's lifecycle stage — these are conveyed by a `StatusTag`
  glanced at from across a desk, not a sentence someone has to read.

## Why this is written down explicitly

This project deliberately mirrors the *process* the sibling Daddy Bear
project used (a short, rule-stating design-system doc set backed by real
tokens and components) but not its *voice* — Daddy Bear is a marketing site
for a film ("considered, warm, unhurried"); Roomick is a piece of operational
software people use dozens of times a day under time pressure. Copying its
tone here would be wrong for what this product is.

**The working test:** if a screen would look at home on a landing page, it's
probably too loose for Roomick. If a front-desk agent can parse it in under a
second with a guest waiting, it's on brand.

## One more nuance: product brand vs. tenant brand

Roomick's own gold/purple chrome (nav, primary actions, the Roomick
wordmark) is the *product's* brand — separate from any future per-hotel
white-labeling. The backend already models multi-tenant branding
(`BrandMode: single | multi` — see `04-components/forms.md`'s
`BrandRadioCard`), and a hotel operator will eventually be able to put their
own logo and colors on guest-facing surfaces. When that lands, **status
colors always outrank tenant theming** — a room being `out_of_order` has to
stay visually unambiguous no matter what colors a tenant has chosen
elsewhere, because it carries operational meaning a color clash could
obscure.
