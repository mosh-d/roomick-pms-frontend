# Forms

Components: `Input`, `Textarea`, `Select`, `YesNoToggle`,
`MultiSelectTagInput`, `BrandRadioCard`, `LogoUpload`, `FormSection` (all in
[`components/ui/`](../../components/ui/)).

## Pattern

Forms use **React Hook Form + Zod** — a validation schema defined once,
reused for real-time client-side feedback. (Unlike Daddy Bear, there's no
Next.js API route to share the same schema with yet — Roomick's forms will
eventually submit to the separate NestJS backend, which has its own
class-validator DTOs; sharing one schema across that language/framework
boundary is future work, not this phase.) See `/style-guide`'s
`FormsSection` for a working `zodResolver` example.

## Field anatomy

Label always **above** the field, never placeholder-as-label — a
placeholder-only label fails accessibility (no persistent screen-reader
association) and disappears the instant someone starts typing, which is a
real cost in a workflow where speed matters (`00-brand-voice.md`).

Base field: `bg-white border border-accent/40 rounded-control px-4 py-2.5
text-body`, focus ring `ring-primary`. Error state: `border-red-600`
(Tailwind's default red — no brand error color was specified) + one line of
error text below, wired to the field via `aria-describedby` so a screen
reader announces it.

## Per-component notes

- **`Input`** — optional trailing helper-icon slot (an info glyph, shown
  when a `hint` prop is set) matching the reference image's helper-icon
  field.
- **`Select`** — a hand-rolled listbox, not a native `<select>`. The
  reference image's open-state look (selected option highlighted in
  `secondary-light`) isn't reliably stylable on a native `<select>`
  cross-browser, especially on Windows. Full keyboard support
  (Arrow/Enter/Escape) and ARIA roles (`combobox`/`listbox`/`option`) are
  hand-built to compensate for opting out of native semantics — see the
  component's own header comment for the exact pattern.
- **`YesNoToggle`** — the opposite choice: built on real native `<input
  type="radio">` elements (visually hidden, styled sibling labels), because
  the pill-segment visual the reference shows *is* achievable with a native
  element, so there's no reason to hand-roll ARIA when the browser gives it
  for free.
- **`MultiSelectTagInput`** — one component, not two, covering both
  reference-image behaviors (dropdown-constrained chips vs. free-text
  add-new) via an `allowCustom` prop.
- **`BrandRadioCard`** — maps to the backend's `BrandMode` enum
  (`single | multi`). Selected state reuses `Card`'s exact tint classes
  (`bg-primary/10 border-primary/20`) since a selected radio-card *is*
  visually a Card. "Single Brand" mode nests a nested `Input` for the one
  brand name it needs up front.
- **`LogoUpload`** — a hidden native `<input type="file">` is always the
  primary interaction (keyboard-reachable, opens the OS picker); drag-and-
  drop is layered on top as a progressive enhancement, never the only way
  in. Preview uses `next/image` with `unoptimized` (the built-in image
  optimizer can't reach a browser-local `blob:` URL), and the object URL is
  memoized + revoked on change/unmount to avoid leaking blob URLs across
  re-renders.
- **`FormSection`** — a real `<fieldset>`/`<legend>`, not a styled `<div>`
  with a floating label. Gets the reference image's dashed-border-with-
  label look from native HTML, plus real screen-reader grouping for free.
