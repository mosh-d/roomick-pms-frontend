# Forms

Components: `Input`, `Textarea`, `Select`, `YesNoToggle`,
`MultiSelectTagInput`, `RadioCard`, `BrandRadioCard`, `LogoUpload`,
`FormSection` (all in [`components/ui/`](../../components/ui/)).

## Pattern

Forms use **React Hook Form + Zod** — a validation schema defined once,
reused for real-time client-side feedback. (Unlike Daddy Bear, there's no
Next.js API route to share the same schema with yet — Roomick's forms will
eventually submit to the separate NestJS backend, which has its own
class-validator DTOs; sharing one schema across that language/framework
boundary is future work, not this phase.) See `/style-guide`'s
`FormsSection` for a working `zodResolver` example.

**Every `useForm()` call uses `mode: 'onTouched'`.** The default
(`onSubmit`) means a field never shows its error until the whole form is
submitted once — on a multi-field form that reads as "nothing happened" the
first few times a user tabs past an invalid field. `onTouched` validates a
field the moment it first loses focus, then re-validates live on every
keystroke after that — so a mistake is flagged immediately, and fixing it
clears the error as you type, not only after you click away again.

This landed after `mode: 'onBlur'` shipped first and turned out to be a
real bug, not a style choice: RHF's `reValidateMode` (which governs live
re-validation on subsequent keystrokes) only takes effect once, but with
`mode: 'onBlur'` a field only re-validates on the *next blur* — so typing a
fix left the error sitting on screen the whole time you were correcting it,
only clearing once you clicked away again. `onTouched` is RHF's own
purpose-built mode for exactly this pattern — validate on first blur, then
live after that — confirmed with a real keystroke-by-keystroke Playwright
test (`.fill()` alone doesn't reproduce the gap; it never blurs). This
isn't optional per-form — treat it as part of the pattern, not a per-field
judgment call.

## Field anatomy — underline, not a bordered box

Corrected after reviewing the actual product reference (`Roomick-UI.pdf`)
closely — an earlier version of every field component in this system used
a bordered-box style that doesn't match the real product at all. The real
anatomy, seen on nearly every field across the reference:

1. **Label** — bold, always above the field, never placeholder-as-label (a
   placeholder-only label fails accessibility — no persistent screen-reader
   association — and disappears the instant someone starts typing, a real
   cost in a workflow where speed matters, `00-brand-voice.md`).
2. **Value** — plain text, no surrounding box.
3. **Underline** — a bottom border only (`border-0 border-b`), full width.
   Default `border-accent/40`; on focus, `border-secondary` (solid,
   saturated) — not a focus *ring*, a color change on the underline itself.
4. **Info icon** — a small gray `ⓘ` on its own row *below* the underline
   (not floating inside the field), shown when a `hint` is provided; hover
   reveals the hint via `title`.

**Focus state**: the whole label+field+icon group gets a light
`secondary-light` tint background (`focus-within:bg-secondary-light/15`),
not just the input itself — visible on "Last Name" in the reference's Owner
Account Form. Implemented with a padding/negative-margin pair
(`px-3 -mx-3`) so the tinted box appears with zero layout shift: the
padding is always reserved, only its background is conditional.

**Error state**: `border-red-600` on the underline (overrides the focus
color too) + red error text on the icon row — **beside the info icon, not
replacing it**. An earlier version of `Input` showed the icon *or* the
error text, never both, which meant a field with a hint lost its hint the
moment it also had an error. Both render together now: icon (if `hint` is
set) then error text (if `error` is set) in the same row, `aria-describedby`
pointing at whichever (or both) exist.

## Per-component notes

- **`Input`** / **`Textarea`** — the underline anatomy above. Textarea
  keeps the same underline (not a full box) for consistency, just
  multi-row. `Input` with `type="password"` gets a built-in show/hide
  toggle (an eye icon inside the field, own `useState`) rather than relying
  on the browser's native reveal control — Chrome's native one doesn't
  reliably reappear after the field loses and regains focus, which read as
  a real bug ("I can't see what I typed anymore"), not a cosmetic one.
  Controlling it in-component means it behaves the same way every time.
- **`Select`** — a hand-rolled listbox, not a native `<select>` (the
  reference's open-state styling isn't reproducible on a native element
  cross-browser). Two things distinguish it from a typical custom select:
  the **trigger is an underline field**, matching Input, not a bordered
  box; and the **open listbox renders inline** (in normal document flow,
  pushing content below it down), not as an absolutely-positioned floating
  popover — the reference shows subsequent fields visibly displaced while
  a Select is open, not covered by an overlay. While open, the whole
  trigger+listbox group sits in a `bg-secondary-light/15` box (state-driven
  by the `open` boolean, not `focus-within` — the trigger keeps DOM focus
  the entire time via a managed-focus / `aria-activedescendant` pattern, so
  CSS focus alone can't drive this). The selected/highlighted option is a
  solid `bg-secondary-light` bar with a checkmark, not a subtle tint. The
  trigger is a real `<input>`, not a `<button>` — added once a 195-entry
  country list (`lib/countries.ts`) made click-and-scroll the only way to
  pick anything genuinely painful. Typing filters `options` live (case-
  insensitive substring match on `label`); opening always starts the
  filter empty, and closing (Escape, selecting, clicking outside) reverts
  the field to showing the selected option's label.
- **`YesNoToggle`** — the opposite choice from Select: built on real native
  `<input type="radio">` elements (visually hidden, styled sibling
  labels), because the pill-segment visual the reference shows *is*
  achievable with a native element, so there's no reason to hand-roll ARIA
  when the browser gives it for free.
- **`MultiSelectTagInput`** — one component, not two, covering both
  reference behaviors via an `allowCustom` prop: dropdown-constrained
  (chips above, an inline checklist below reusing `Select`'s open-box
  styling — checkmarks toggle membership) and free-text (an underline
  field + Add button/Enter-to-add).
- **`RadioCard`** — the general-purpose "radio selection whose content
  changes based on which option is picked" primitive. **One rendering
  path, not a variant switch**: an option with a `description` gets full
  card chrome (title + description, tinted when selected); an option with
  no `description` renders as a plain radio + label. Two structural facts,
  both confirmed against the reference (corrected after an earlier version
  got the layout wrong): **options render inline on one row**
  (`flex flex-wrap`), not stacked one per line — every plain-radio-row
  example in the reference (Digital/Manual Capture, Fixed/Percentage Rate,
  Single/Multi-Brand Structure) puts both choices side by side; and the
  selected option's `content` renders **once, below the whole row**, not
  nested under that specific option's position in a vertical stack (there
  is no vertical stack to nest under). The radio dot is always `secondary`
  (near-black), never `tone` or primary gold — it's UI chrome, not tinted
  content. See `lib/deriveRoomStatus.ts`-style reasoning: one place owns
  this logic, not re-derived per feature.
- **`BrandRadioCard`** — a thin, domain-specific wrapper around
  `RadioCard` (`tone="secondary"`): owns the `BrandMode` enum's option
  copy only (no descriptions, matching the reference) and delegates all
  actual rendering to `RadioCard`. Neither option nests a field — an
  earlier version put a "Brand Name" `Input` on `single` only, removed
  once the backend started deriving the head brand's name from the
  organization name already collected at signup, for single and multi
  mode alike (see `roomick-pms-backend/PHASE_NOTES.md`'s `configure-mode`
  entry). This is still the pattern for any future feature-specific
  radio-card use — a thin wrapper supplying option copy (and content, when
  a feature actually needs it), never hand-rolled radio/card markup again.
- **`LogoUpload`** — a hidden native `<input type="file">` is always the
  primary interaction (keyboard-reachable, opens the OS picker); drag-and-
  drop is layered on top as a progressive enhancement, never the only way
  in. Preview uses `next/image` with `unoptimized` (the built-in image
  optimizer can't reach a browser-local `blob:` URL), and the object URL is
  memoized + revoked on change/unmount to avoid leaking blob URLs across
  re-renders. (The reference shows a *pair* of upload dropzones — light and
  dark logo variants, side by side, with one caption — a multi-file layout
  this component doesn't cover yet; noted for a later phase, not built.)
- **`FormSection`** — a real `<fieldset>`/`<legend>` for form-only
  grouping without the full `Section` treatment (see
  `04-components/layout-patterns.md` for `Section`, which is the primary
  page-structure pattern used throughout the reference — "EARLY CHECK-IN",
  "GUEST DETAILS", etc.).
