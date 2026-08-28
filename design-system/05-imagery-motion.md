# Imagery & motion

Short and utilitarian on purpose — the opposite emphasis of a marketing
site's photography-led doc, since this phase has no photography subject
matter (no hero shots, no brand photography).

## Iconography

Sourced from `react-icons` (Feather for generic UI chrome, Font Awesome
where an exact semantic match exists — a landing plane, a receipt, a "ban"
glyph for Room Blocking/OOO), wrapped one-to-one in named exports in
[`components/ui/Icons.tsx`](../components/ui/Icons.tsx) — every page still
imports from that one module, not from `react-icons` directly, so the
underlying library is swappable in one file. Superseded the project's
original hand-rolled-inline-SVG-only stance (direct instruction) once the
set grew past ~30 bespoke icons; still `currentColor`-based (react-icons
components inherit text color the same way) and `aria-hidden`, always
paired with visible text or an `aria-label` on their containing interactive
element.

## Images

`next/image` is reserved for real raster content — currently just
`LogoUpload`'s file-preview thumbnail, rendered with `unoptimized` since
it's previewing a browser-local `blob:` URL the server-side optimizer can't
reach. No other image usage exists yet in this phase.

## Motion

Kept to functional micro-transitions only: hover/focus color and brightness
changes, a loading spinner, a dropdown's open/close and chevron rotation.
Nothing decorative, nothing that exists purely to look impressive —
consistent with "efficient over decorative." `app/globals.css` includes a
`prefers-reduced-motion: reduce` block that collapses all of the above to
near-instant for users who've asked for it at the OS level.
