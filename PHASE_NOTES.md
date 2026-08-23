# Phase Notes

Application-level build log — what's been built, in what order, and why. Component-level decisions live in `design-system/` instead (each doc there covers one component/pattern in depth); this file is for pages, routing, API integration, and cross-cutting architecture. Mirrors the backend's own `PHASE_NOTES.md` convention.

## Phase 1 — Design System (2026-08-21 to 2026-08-22)

### Delivered
- Next.js 16 scaffold (App Router, Turbopack), Tailwind v4 tokens matching the brand spec (8-color palette, Satoshi/Playfair Display typography, the card-nesting opacity mechanic).
- Component library in `components/ui/`: Button, Card, Input, Textarea, Select, YesNoToggle, MultiSelectTagInput, RadioCard, BrandRadioCard, LogoUpload, FormSection, Section, EntryCard, FeatureCard, StatusTag, Text, Container, Icons.
- `/style-guide` route — the live verification surface for every component/token/state; the primary way UI work here gets checked (screenshotted and interacted with, not just read as code).
- `lib/deriveRoomStatus.ts` — single source of truth for the composite room-status badge (3 backend columns → 1 display value).
- Zustand + TanStack Query installed, `QueryClientProvider` wired in `app/providers.tsx`. No real store/query exists yet — nothing to hold until a real feature needs it.

### Decisions & deviations
1. **Several early components were built from partial/cropped reference screenshots instead of the full `Roomick-UI.pdf`**, and every one of them needed correcting once the full 35-page PDF actually got rendered and reviewed page-by-page (`pdftoppm`/poppler-utils isn't installed in this environment and a Chocolatey install fails on permissions — `pip install --user pymupdf` + rendering via `fitz`/`pymupdf` in Python is the working alternative). Corrected: Input/Select/Textarea's field anatomy, RadioCard's entire structure, BrandRadioCard's invented option descriptions, EntryCard's tint, whether `Section` exists as a pattern at all. **Lesson carried forward, saved to memory**: check `Roomick PMS/references/` (the PDF + `pms-frontend-structure-2.html` + the DB/frontend architecture docs) before building or changing anything here, not after.
2. **Real field anatomy** (once corrected): underline style, not bordered boxes — label above, value, bottom-border-only underline, info icon below-left, `focus-within` secondary-tint background instead of a focus ring.
3. **`RadioCard`: one rendering path, no variant prop.** Options render inline on one row (not stacked); the selected option's content renders once below the whole row, not nested per-option. Whether an option gets full card chrome (title + description, tinted) is driven by whether it has a `description` — data, not a flag.
4. **Card nesting uses dark-variant tints** (`primary-dark`/`secondary`/`accent-dark`), not the base brand colors — base-color tints compounded toward a pastel that lost contrast against `text-secondary-light` at nesting depth (a real legibility bug, caught in the style guide). `primary-light` is reserved specifically for `Section` wrappers and whole-page Review/Summary contexts — never for ordinary nested content inside a `Section` (that's `secondary`, to avoid "mixing" same-hue tints).
5. **Primary buttons use white text**, not the WCAG-driven `text-secondary` an earlier pass chose — the actual reference imagery (Confirm Check-In, the Check-In nav panel) uses white, and consistency with the reference won out. Documented, accepted contrast tradeoff (~2.45:1), same treatment as the VIP badge in `StatusTag`.

### Carried forward
- Real app pages (auth, onboarding wizard, Front Desk) — Phase 2, below.
- API client / env plumbing (`NEXT_PUBLIC_API_URL`, fetch wrapper, auth token storage) — nothing calls the backend live yet.
- Nav/app-shell (solid-primary panel pattern, noted in `design-system/04-components/cards.md`, not built — don't confuse it with `Section`'s translucent tint).
- A real icon set for `FeatureCard` — currently reuses placeholder icons from `Icons.tsx`.

### How to verify this phase
```
npm run dev
# open http://localhost:3000/style-guide
npm run lint && npx tsc --noEmit && npm run build
```

## Phase 2 — Signup, step 1: Owner Account (2026-08-22)

### Delivered
- `lib/api.ts` — `apiFetch()` fetch wrapper + `ApiError` class matching the backend's `ProblemJsonExceptionFilter` response shape exactly (`{ type, title, status, code, detail?, errors? }`, RFC 9457). `ApiErrorCode` is a hand-maintained literal union mirroring the backend's `error-codes.ts` (no shared-types package between the two repos yet).
- `lib/schemas/auth.ts` — Zod schemas mirroring `register.dto.ts`/`verify-email.dto.ts` field-for-field (including the subdomain regex and the exact password rule), so client-side validation rejects the same inputs the server would.
- `app/signup/page.tsx` — a real, working two-step flow: Owner Account Form (`POST /auth/register`) → Verify Email (`POST /auth/verify-email`), built with RHF + `zodResolver` + the design-system components, wired to the actual backend endpoints — not a mock.
- `.env.local`/`.env.example` — `NEXT_PUBLIC_API_URL`.
- Demo vs. real signup choice — a plain inline `RadioCard` row ("Try a demo" / "Get started") shown before the Owner Account form; picking demo just sets `isDemo: true` in the `/auth/register` payload. Backend support (auto-expiry + `DELETE /tenants/me`) landed the same day — see `roomick-pms-backend/PHASE_NOTES.md`'s "Demo tenants + delete organization" entry.

### Decisions & deviations
1. **Built against the real backend DTO, not the reference doc's staged payload.** `pms-frontend-structure-2.html`'s Owner Account Form example doesn't include `subdomain`/`groupName` (it stages those into a separate "Step 2 — Hotel Structure Selection"); the actual `RegisterDto` needs both in the one `/auth/register` call. One combined "Owner account" + "Organization" form, matching what the endpoint actually requires.
2. **The verification token is pre-filled in the UI, visibly and with an explanation**, not hidden — `VerifyEmailDto`'s own comment says the token is "stubbed in MVP" (no email-sending infrastructure exists yet), so pretending otherwise would just be confusing. This is a deliberate, temporary dev convenience called out in the UI copy itself; remove the pre-fill once real email delivery exists.
3. **No session/login wiring yet, on purpose.** Neither `register()` nor `verify-email` returns an access token (confirmed against the real backend — see Phase 1's note on this same mismatch), so there's nothing to store yet. `/auth/login` is the actual dependency for that, and login isn't built.

### Verified
Real Playwright run against the live backend + local Postgres (not a mock): filled the form, `POST /auth/register` → 201, token pre-filled, `POST /auth/verify-email` → 200, reached the confirmation step — then confirmed the row actually landed in `tenants` via a direct `psql` query. Zero console/page errors. Re-verified with the demo toggle on: `isDemo`/`demoExpiresAt` confirmed correctly persisted from a real UI submission (not just a direct API call).

**A second reference/backend mismatch, same shape as the first**: `pms-frontend-structure-2.html`'s `/tenants/configure-mode` payload example is `{ mode: "single_brand"|"multi_brand", groupName, primaryBrandName }`. The real `ConfigureModeDto` is `{ mode: "single"|"multi", brandName? }` — different enum values, different field names, one fewer field. Caught the same way as the first one: by actually calling the live endpoint rather than trusting the doc. Building the Organization Structure step (next phase) needs to read `configure-mode.dto.ts` directly, not the reference doc's example.

**Local dev note**: the backend and frontend now correctly run on their intended ports (backend 3000, frontend 3001 — see this file's README section) — for most of this project's life they'd both been defaulting to 3000, which went unnoticed until wiring a real API call actually required both running simultaneously.

### Carried forward
- Rest of the onboarding wizard: Organization Structure (Brand Mode), Branch Setup, Room Types/Rooms, Review — confirmed against `pms-frontend-structure-2.html`'s API contract (`/tenants/configure-mode`, `/brands/:id/branches`, `/buildings/:id/floors`, `/branches/:id/room-types`, `/branches/:id/rooms/bulk`).
- `/login` page — needed before any authenticated route can be built (nothing issues a usable access token before it).
- Auth token storage/session strategy — not decided yet; needs `/login` to exist first to have something to store.

**Security note** (from before this phase started): the backend's `/auth/register` (and `/login`/`/verify-email`/`/refresh`/`/accept-invite`) is rate-limited (`@nestjs/throttler`) — `register()` provisions a full tenant + owner + 6 roles per call, not a plain insert, so leaving it fully open while a public form exists in front of it was a real gap, not a theoretical one. See `roomick-pms-backend/PHASE_NOTES.md`'s "Hardening — Auth rate limiting" entry.

## Phase 3 — Rest of the onboarding wizard (2026-08-23)

### Delivered
- `lib/store/authStore.ts` — the first real Zustand store (installed since Phase 1, unused until now): `accessToken`/`refreshToken`/`user` + a `login()` action. Deliberately **not persisted** to `localStorage`/`sessionStorage` — see its header comment: writing a bearer JWT to persistent storage before a real session strategy exists would be picking a security posture by accident, not on purpose. In-memory only, so a hard refresh mid-wizard loses the session (no `/login` page exists yet to recover from that either — an honest, visible limitation, not a silent one).
- `app/signup/_steps/` — the wizard split into one component per step (mirrors `app/style-guide/_sections/`'s existing convention), orchestrated by `page.tsx`'s step state machine: `RegisterForm` → `VerifyEmailForm` → `AutoLoginStep` (new — see below) → `OrgStructureForm` → `CreateBrandStep` (multi-brand mode only) → `BranchSetupForm` → `RoomTypeForm` → `RoomsForm` → `ReviewStep` → complete.
- `AutoLoginStep` — bridges register/verify-email (neither issues an access token) to the rest of the wizard, which needs one (`configure-mode` and everything after it requires `Authorization: Bearer` + `X-Tenant-ID`). Silently calls `POST /auth/login` with the email/password the owner just typed during registration, threaded forward in memory (never stored) — a standard "verify → signed in automatically" pattern, not a workaround.
- `lib/schemas/onboarding.ts` — Zod schemas for every remaining DTO (`configure-mode`, `brand`, `branch` + `address`, `room-type` + `capacity`, `rooms/bulk` range variant), built by reading the actual DTO files first, not `pms-frontend-structure-2.html` (see Phase 2's two documented mismatches — this phase's schemas were correct on the first pass because of that lesson).
- `StaffInviteStep` — added after a deeper reference pass (see below): fetches `GET /auth/roles`, a repeatable email+role row list (RHF `useFieldArray`), "Skip for now", submits to the real `POST /branches/:branchId/staff/invite`. `RoomTypeForm` also gained `sizeM2` (Room Size), a real `CreateRoomTypeDto` field that was simply missed on the first pass.
- Full live Playwright run against the real backend + local Postgres: demo signup → register → verify → auto-login → single-brand structure → branch setup → room type (incl. `sizeM2`) → 5 rooms bulk-created (301–305) → staff invite (both the skip path and a real invite send, role picked from the live `GET /auth/roles` list) → review (confirmed every created value, including the invited staff row, renders correctly) → finish. Zero console/page errors.

### Decisions & deviations
1. **Buildings/floors ("Full" onboarding mode) are not built.** `rooms/bulk`'s `floorId` is optional and the backend auto-creates a hidden default building/floor when it's omitted — its own doc comment calls this the "Rooms Only" onboarding mode. This wizard uses that mode. Unlike the items in note 3 below, this one **is** a real, confirmed-buildable feature deliberately left for later — `Roomick-UI.pdf` pages 3–4 show a genuinely bigger flow (multi-building tree, per-building/per-floor multiplicities, a "Views" multi-select per building, room types set up *per building* rather than per branch) that would reshape how Room Types/Rooms work here, not just add one more step. Worth planning properly rather than bolting on.
2. **One room type, one room-creation batch.** The DTOs support creating many of each; looping the wizard to add more is real Room Types/Rooms *management* UI, not first-run onboarding — deferred to a proper post-onboarding screen, not built speculatively here.
3. **No star rating, no tax-rule config, no logo upload — confirmed backend-blocked, not just deferred.** `CreateBranchDto` has no star-rating field at all (a third reference/backend mismatch). `TaxRule` exists as a Prisma *model* but has zero controller/service/DTO anywhere in the backend — there is no endpoint to call. `CreateBrandDto.logoUrl` is a plain string field and there is no file-upload endpoint (no multer/`FileInterceptor` anywhere in the codebase) — the reference's drag-and-drop uploader has nothing to upload *to* yet. All three are correctly out of scope until the backend actually supports them, confirmed by grepping the backend, not assumed.
4. **Staff Invite, by contrast, *is* real and is now built** (see Delivered) — `POST /branches/:branchId/staff/invite` + `GET /auth/roles` both exist and work. This was missed on the first pass through this phase because that pass read `pms-frontend-structure-2.html`'s text (which files Staff Invite under a separate future `/onboarding` post-signup route) without also rendering the actual `Roomick-UI.pdf` mockup pages for this step, which show Tax Rule Configuration *and* Staff Invite side by side inside the initial `/signup` wizard's Branch Setup screen. Caught after being told to check reference tooltips/info-icon content, not just field labels — see [[roomick_pms_reference_tooltips]]. Lesson: the HTML doc's text and the PDF mockup aren't always in sync with each other either; when they conflict, check what the backend can actually do, not which reference document looks more authoritative.
5. **Country/timezone/currency are free-text fields with format hints** ("ISO 3166-1 alpha-2, e.g. NG", "IANA timezone, e.g. Africa/Lagos"), not proper pickers — a full country/timezone/currency dataset is real data-entry work, not core wizard logic. Validated client-side against the same regex/length constraints as the DTO either way.
6. **`z.coerce.number()` doesn't type-check cleanly against RHF's `useForm<T>()` generic** (the resolver's inferred input type has `unknown` for coerced fields, which RHF's `<T>` rejects). Fixed by using plain `z.number()` in the schema and RHF's own `register(field, { valueAsNumber: true })` on every numeric input instead — RHF converts the string before Zod ever sees it, so the two type parameters agree. The one exception is an *optional* numeric field (`sizeM2`): `valueAsNumber` turns an empty input into `NaN`, not `undefined`, which fails `z.number().optional()`. Used `setValueAs: (v) => (v === '' ? undefined : Number(v))` there instead. Worth knowing before adding the next numeric field anywhere in this app.
7. **Landing page copy was scoped too narrowly to "front desk."** Caught by direct feedback, not self-review: `roomick-landing`'s hero/value-prop copy described the product as front-desk software, but the references (`pms-frontend-structure-2.html`'s nav — 24 modules including Housekeeping, Maintenance, Billing, POS, RMS, Reports, RBAC) describe a full multi-department PMS. Fixed in `roomick-landing/app/page.tsx` — hero and all three value props now name front desk, housekeeping, maintenance, billing, and reporting explicitly, not front desk alone. This app's own `design-system/00-brand-voice.md` was checked too and was already correct (already names both a front-desk agent and a housekeeper) — the narrowing was isolated to the marketing copy.

### Verified
`npm run lint` and `npx tsc --noEmit` both clean. Live Playwright run described above — every step gated on the previous step's real server-returned id (`brandId` → `branchId` → `roomTypeId`), so a pass here means the whole chain of real backend calls actually works, not just that the UI renders. Confirmed with two separate runs: one taking "Skip for now" on Staff Invite, one actually sending an invite and checking it shows up correctly on Review.

### Carried forward
- `/login` page for returning visits — `AutoLoginStep` only covers the immediate post-verify moment; there's still no way to sign back in later.
- Real session strategy (httpOnly refresh cookie vs. rotating memory-only access token, etc.) — `authStore`'s in-memory-only choice is a deliberate stopgap, not the final answer.
- "Full" onboarding mode (buildings/floors, per-building room types) and multi-room-type/multi-batch room creation — real backend DTOs already exist; this is a genuinely bigger restructuring, not a quick add. See decision 1 above.
- Tax rule configuration and logo upload — backend-blocked (no endpoint exists for either); revisit once that backend work lands.
- Proper country/timezone/currency pickers.
- A front-desk/operations dashboard — nothing past `/signup` exists yet; `step === 'complete'` just says so.

## Phase 4 — Login page (2026-08-23)

### Delivered
- `app/login/page.tsx` — a standalone login page: email/password/subdomain, `lib/schemas/auth.ts`'s new `loginSchema` (mirrors `LoginDto`; `subdomain` made required client-side even though the DTO marks it optional — a public login page has no `X-Tenant-ID` header to fall back on, so it's not actually optional for this flow). Calls the same `authStore.login()` action `AutoLoginStep` already uses inside the wizard — this page is just the manual entry point to it.
- `RegisterForm` now links to `/login` ("Already have an account? Log in") — the reference's Owner Account Form UI-component list names this exact link; it just hadn't been built yet. `/login` links back to `/signup` the same way.
- Friendly error mapping for `INVALID_CREDENTIALS` and `EMAIL_NOT_VERIFIED`, matching the pattern every other form in this app already uses.

### Decisions & deviations
1. **On success, there's deliberately nowhere real to send anyone yet.** No dashboard/front-desk UI exists past `/signup` — so a successful login just confirms who's signed in (name, email, pulled straight from `authStore`'s `user`), the same "next phase" placeholder pattern the wizard's own `complete` step already uses. Not a shortcut; there's genuinely nothing to redirect to until that UI exists.
2. **No "forgot password" flow.** The backend has no password-reset endpoint at all (checked, not assumed) — out of scope until it does.

### Verified
`npm run lint` and `npx tsc --noEmit` both clean. Live Playwright run against the real backend: created + verified a fresh account via direct API calls, then drove the actual `/login` page — wrong password shows the friendly error text (not a raw API error), correct credentials sign in and show the right name/email, and the `/signup` → `/login` link round-trips correctly.

### Carried forward
- Real session strategy — still the same open item from Phase 3; a `/login` page existing doesn't change that decision, it just gives `authStore` a second caller.
- A destination for a successful login (dashboard) — see decision 1.
- Password reset — backend has no endpoint for it yet.

## Phase 5 — Design-system corrections + wizard chrome + form UX (2026-08-23)

Two batches of direct feedback in one sitting: visual/token corrections
caught by inspecting the running `/style-guide`, then a much larger set
caught by comparing the live `/signup` wizard against the actual
`Roomick-UI.pdf` pages side by side (not the HTML text summary — the pages
themselves).

### Delivered — design tokens
- `Card`'s `primary` tone now uses `bg-primary-light/15 border-primary/40`
  (reusing `Section`'s own pairing) instead of `bg-primary-dark/10` — the
  old formula rendered as a muddy tan; the reference shows a pale warm-gold
  highlight. This is a deliberate exception to the dark-variant/10%-per-
  layer rule the other two tones still follow (`primary`'s base tint is
  15%, since `primary-light` is already too pale for 10% to read at all) —
  see `01-color.md`.
- `Button`'s hover states: `primary` `brightness-110` → `-125`, `secondary`
  `brightness-125` → `-200`. Both were too subtle to read as "hovered" —
  verified by actually hovering in a screenshot, not just picking bigger
  numbers. `secondary` needed a much bigger jump for a specific reason:
  `#160029` has a zero green channel, and `brightness()` is a linear
  per-channel multiplier, so `-150` was still barely perceptible.
- A global fix for the browser's native autofill background (Chrome's
  default pale blue) bleeding through `Input`'s transparent styling —
  two stacked techniques (transition-delay suppression + inset box-shadow
  fallback) in `app/globals.css`, since the delay trick alone isn't
  reliably honored across every Chromium version. **Not fully verified**:
  headless Playwright doesn't replicate Chrome's real saved-profile
  autofill, so this needs a real-browser check, not just a passing test.

### Delivered — wizard chrome and form UX
- `app/signup/_steps/WizardShell.tsx` — the wizard's persistent top bar
  (wordmark, breadcrumb, Cancel) and left sidebar (4 numbered phases),
  replicated from the reference's onboarding pages, which this wizard
  previously had none of — every step rendered as a bare centered form,
  which made the (already-correct) step separation invisible. This wizard's
  ~10 internal `WizardStep`s collapse into the reference's 4 named phases
  (`register`/`verify`/`auto-login` → "Owner Account Form",
  `org-structure`/`create-brand` → "Organization Structure",
  `branch-setup`/`room-type`/`rooms`/`staff-invite` → "Branch Setup",
  `review`/`complete` → "Review") via `page.tsx`'s `PHASE_FOR_STEP` map —
  the reference's own "Branch Setup" page bundles Property Details + Tax
  Rules + Staff Invite into one phase the same way.
- `Input` gained a built-in password show/hide toggle (own `useState`, an
  eye icon inside the field) — fixes a real bug, not a nice-to-have: the
  browser's native reveal icon didn't reliably reappear after the field
  lost and regained focus, which read as "I typed a password and now I
  can't see it anymore."
- `Input`'s hint icon and error text now render **together**, not
  either/or — a field with both a hint and a validation error used to lose
  the hint icon the moment it had an error; now the red error text sits
  beside the icon, matching the reference's per-field `ⓘ` anatomy.
- Every `useForm()` call across the app now sets `mode: 'onBlur'` — errors
  used to only appear after a failed full-form submit; now a field
  validates the moment it loses focus. (Superseded the same day — see
  Phase 6: this turned out to only be half the fix.)
- `RegisterForm`'s Owner Account step now matches the reference field-for-
  field where the backend allows: First Name + Last Name (not one "Full
  Name" field) — joined into the single `name` string `RegisterDto`
  actually wants right before the API call, so the DTO itself didn't need
  to change.

### Decisions & deviations
1. **`Country` (shown on the reference's Owner Account Form) was not built
   in this pass** — `RegisterDto` had no matching field at all (a fourth
   reference/backend mismatch, same shape as the three already documented
   in Phases 2–3), and worse than the others, the global `ValidationPipe`'s
   `forbidNonWhitelisted: true` means sending an undeclared field doesn't
   get silently dropped, it fails the whole request. **Added the same
   day — see Phase 6.**
2. **Group/Hotel Name and Subdomain still live on the Owner Account step**,
   even though the reference's Step 1 mockup doesn't show either. Not an
   oversight — `POST /auth/register` creates the tenant in this one call
   and genuinely needs both then; there's no later point in the flow where
   they could be collected instead without restructuring when the backend
   creates the tenant record. Kept in their own "Organization" section
   below "Owner account" rather than pretending they belong to Step 1's
   reference layout.
3. **The reference's top-right "Continue" button isn't duplicated in
   `WizardShell`.** Every step already has its own working submit button;
   wiring a second trigger for it would mean either threading a submit
   handler up through every step component or faking a button with no way
   to know if the current step's form is submit-ready. `Cancel` (a real
   link home) is the one top-bar action simple enough to wire honestly, so
   that's what's there.
4. **The sidebar shows 4 flat phases, not the reference's nested per-branch
   sub-list** (page 3 of the reference shows "Branch Setup" expanding into
   multiple named branches, e.g. "Caritas Inn Ilasan" / "Caritas Inn
   Lekki"). This wizard only creates one branch per signup pass (see Phase
   3's decision 2 on one-room-type/one-batch) — replicating multi-branch
   sidebar nesting for a flow that can't create a second branch yet would
   be UI with nothing behind it.

### Verified
`npm run lint` and `npx tsc --noEmit` both clean. Full live Playwright
re-run of the entire wizard end to end (register with split name fields →
verify → auto-login → org structure → branch setup → room type → rooms →
staff invite → review → finish) — still passes after all of the above.
Separately verified: the password reveal toggle actually switches the
input's `type`; a deliberately weak password shows the red error beside the
`ⓘ` icon on blur (screenshotted, not just asserted); the wizard shell's
sidebar highlights the correct phase at each step (screenshotted).
Autofill fix could not be verified this way — see the note above.

### Carried forward
- `Country` field — needs a backend DTO change first; not attempted here.
  **Done same day — see Phase 6.**
- Real building/floor/multi-branch UI — same "Full onboarding mode" item
  from Phase 3, now additionally confirmed to need matching sidebar nesting
  if it's ever built.
- Verify the autofill fix against a real Chrome profile, not just headless
  Playwright.

## Phase 6 — Real bugs from live use, `Country`, and auto-derived subdomain (2026-08-23)

Phase 5's fixes shipped, then got exercised in an actual browser (not just
Playwright) and turned up real regressions — a genuine "trust but verify"
lesson: a Playwright pass that only ever calls `.fill()` and checks the
next assertion immediately doesn't catch everything a person actually
typing at normal speed, blurring, re-focusing, and looking at the screen
will.

### Delivered
- **`Country` field, end to end.** `roomick-pms-backend`: `Tenant.country`
  (nullable `VARCHAR(2)`, migration `20260823000000_tenant_country`),
  `RegisterDto.country?` (`@IsISO31661Alpha2()`), wired through
  `AuthService.register()`. `roomick-pms-frontend`: `lib/countries.ts` (a
  static ISO 3166-1 list — no reason to fetch something this small from
  anywhere), a real `Select` in `RegisterForm` paired with Email (matching
  the reference's Email/Country row), `registerSchema` validates it as an
  optional 2-letter code. Verified past the API response — read back
  directly via the Prisma client after a real registration, not just "the
  request didn't fail."
- **Subdomain is now auto-suggested from Group/Hotel Name**, not typed from
  scratch — `lib/slug.ts`'s `slugify()`, live via a `watch()` + `useEffect`
  in `RegisterForm`, stops following the moment the owner edits the
  subdomain field themselves (a `subdomainEdited` flag). Still a real,
  editable field — a `SUBDOMAIN_TAKEN` conflict is still recoverable by
  hand — just no longer something to invent unprompted. Hint copy now
  explains what it actually is (a login id, not yet a public URL) with a
  concrete before/after example, per direct request.
- **Fixed: validation errors didn't clear while fixing them.** The real
  bug behind "the validation messages don't disappear even when I enter
  the correct thing" — `mode: 'onBlur'` (Phase 5) only re-validates an
  errored field on its *next blur*, not while typing, until the form has
  been submitted once. Switched every form to `mode: 'onTouched'` — RHF's
  own purpose-built mode for this exact pattern (validate on first blur,
  then live on every keystroke after that). Confirmed the distinction
  matters with a real keystroke-by-keystroke Playwright test
  (`pressSequentially`, not `.fill()`) — `.fill()` doesn't reproduce the
  gap because it doesn't blur.
- **Fixed: two eye icons in the password field.** Chrome's own
  key/reveal icon (tied to its password-manager heuristics) was stacking
  with `Input`'s controlled toggle. Fixed properly, not just papered over:
  `autocomplete="new-password"` on the signup password field and
  `"current-password"` on login (the actual semantic fix — tells Chrome's
  password manager which of its own behaviors applies) plus a CSS fallback
  hiding the specific pseudo-elements Chrome/Edge use for it.
- **Fixed: the autofill fallback color was still a visible mismatched
  band.** Phase 5's flat `white` fallback didn't match the pale-cream
  `Section` background most inputs actually sit on. Replaced with
  `color-mix(in srgb, var(--color-primary-light) 15%, white)` — the exact
  flat color `bg-primary-light/15` renders to — computed from the token,
  not a hand-picked hex.
- **Sidebar phases you've already passed are now real navigation**, not
  just `cursor-pointer` styling with nothing behind it — clicking one
  jumps back to that phase's first step (`WizardShell`'s new `onNavigate`
  prop). The current phase and anything still ahead stay non-interactive —
  see the decision below on why.
- Primary button hover: text now switches to `text-secondary` on hover —
  Phase 5's brightened gold fill (`brightness-125`) pushed white text's
  already-marginal contrast lower than intended.

### Decisions & deviations
1. **Backward sidebar navigation doesn't undo or re-edit already-created
   backend resources.** Clicking back to "Owner Account Form" after
   `register()` already created the tenant just re-shows that form, empty
   — resubmitting it will hit `EMAIL_TAKEN`/`SUBDOMAIN_TAKEN`, a visible,
   expected error rather than a silent duplicate. Real "go back and edit
   what you already created" semantics (PATCH-ing the existing tenant/
   branch/etc. instead of re-POSTing) is a bigger feature, not attempted
   here — this is a known rough edge, not hidden.
2. **`Country` is reporting-only, same as originally planned** (see
   Phase 5's carried-forward item) — nothing reads it yet beyond the raw
   column; the explicit follow-up flagged is using it to suggest a
   default branch timezone during Branch Setup, not built this pass.

### Verified
`npm run lint` (one non-blocking React Compiler note on `RegisterForm`'s
use of RHF's `watch()` — expected, not a bug) and `npx tsc --noEmit` both
clean, backend `npx tsc --noEmit` clean. Live Playwright re-runs, this time
specifically targeting the failure modes above: real keystroke-by-keystroke
typing (not `.fill()`) confirms errors clear live; password-field
screenshot confirms exactly one eye icon; sidebar-click navigation
screenshotted landing back on the Owner Account form; `country` read back
from the database via the Prisma client after a real registration, not
just checked against the API response.

### Carried forward
- Using `Country` to suggest a default branch timezone during Branch
  Setup — flagged as the reason to add the field, not built yet.
- Real edit/re-submit semantics for backward sidebar navigation past a
  step that already created a resource. **Mostly resolved the same day —
  see Phase 7**: everything from Organization Structure onward no longer
  creates anything until Review's "Finish", so there's nothing to conflict
  with on the way back. Owner Account specifically (the one step that still
  submits immediately) got its own fix — see Phase 7's `RegisterForm`
  entry.
- Encryption at rest for sensitive user fields (email, phone) — explicitly
  requested, scoped as its own focused piece of work rather than folded
  into this batch of UI fixes; see the commit that lands it separately.

## Phase 7 — Deferred submission, wizard data model corrections (2026-08-23)

The single biggest architectural change to this wizard since Phase 3: a
sustained round of direct feedback on the live app made clear the "submit
every step immediately" design (Phase 3 onward) was the wrong shape —
going back to fix or check something re-triggered an already-succeeded API
call and failed (`SUBDOMAIN_TAKEN`, etc.), and nothing survived a page
reload. Both are symptoms of the same root cause: steps 4–9 had no reason
to touch the backend before the owner actually confirms everything at
Review.

### Delivered
- **`lib/store/wizardStore.ts`** — a new persisted (localStorage) Zustand
  store holding the *entire* draft: every step's field values, which
  internal step you're on, and (for Organization Structure onward)
  completion-tracking ids (`brandId`, `branchId`, `roomTypeId`, …) set only
  once Review's "Finish" actually creates each resource. Draft types are
  imported from each step's own zod schema (`RegisterFormValues`,
  `BranchSetupFormValues`, …), not hand-duplicated — the store can't drift
  out of sync with the schema that actually validates the data.
- **Organization Structure → Staff Invite are now pure local state.**
  `OrgStructureForm`, `BranchSetupForm`, `RoomTypeForm`, `RoomsForm`,
  `StaffInviteStep` each still run their own zod validation on submit, but
  now just save to `wizardStore` and advance — no API call, matching every
  step from here through Review. The corresponding backend calls (
  `configure-mode`, create branch, create room type, bulk-create rooms,
  send staff invites) all moved into **`ReviewStep`'s "Finish" handler**,
  which runs them in sequence against the real backend. Each result id is
  written back to `wizardStore` the moment it succeeds, so a failure
  partway through (e.g. branch creation works but room-type creation
  fails) can be retried without re-running — and re-failing on — the steps
  that already succeeded.
- **`RegisterForm` now has a read-only mode.** Account creation is the one
  step that still can't be deferred (there's no verifying an email for an
  account that doesn't exist) — so navigating back here after the account
  already exists can't just re-show the same editable form; resubmitting
  fails with `SUBDOMAIN_TAKEN`/`EMAIL_TAKEN`, which was the literal "stuck"
  bug reported. Once `wizardStore.accountCreated` is true, the fields
  render read-only with the values actually submitted, and "Continue" is
  pure navigation. `VerifyEmailForm` and `AutoLoginStep` got the matching
  treatment (`emailVerified`/`loggedIn` flags) for the same reason.
- **`authStore` is now persisted too** — a deliberate reversal of Phase
  3's original decision (see that store's updated header comment). A
  persisted draft with no session to eventually submit it with wouldn't
  actually fix "I lost my progress on reload" — the access token needs to
  survive the same reload the draft does. The underlying trade-off (no
  real session strategy decided yet) is unchanged; this is a bounded call
  for the current onboarding-only scope, not a verdict on session storage
  for the app in general.
- **Data model correction: eliminated the redundant "Brand Name" ask.**
  `configureMode` (backend, `tenants.service.ts`) now always creates the
  head brand — for multi-brand tenants too, not just single — defaulting
  its name to the already-collected `groupName`. This directly resolves
  three things raised together: "what's the need for hotel name when we
  already have brand name" (there wasn't a need — `BrandRadioCard` no
  longer has a nested Brand Name field on *either* option, since the name
  always comes from Step 1); "nothing shows up when I click Multi-Brand
  Structure" (there was never meant to be different content for the two
  options once the redundant field was gone — both are now plain radio
  choices); and the reference's own note ("register your head brand to get
  started... more brands can be added later") — this backend change is
  exactly that. `CreateBrandStep.tsx` (the old separate "name your first
  brand" screen for multi-mode) is deleted; multi-brand tenants can still
  add more brands later via the already-unrestricted `POST /brands`.
- **Sidebar navigation is real now, not just styled.** A commenter pointed
  out clicking a passed sidebar phase did nothing — `cursor-pointer` with
  no `onClick` behind it would just be a different way of lying about
  what's interactive, so `WizardShell` got an actual `onNavigate` prop
  wired to jump back to a passed phase's first step (`page.tsx`'s
  `FIRST_STEP_FOR_PHASE`).
- Clicking the "Roomick" wordmark in the top bar now links to
  `roomick-landing` (`NEXT_PUBLIC_LANDING_URL`, a real cross-app URL, not
  an internal route — the two are separate Next.js apps/ports).

### Decisions & deviations
1. **The password is the one thing that still never gets persisted**,
   even under "make our data survive reloads." It's held in a plain,
   non-persisted `useState` in `page.tsx` for the few seconds between
   `RegisterForm`'s submit and `AutoLoginStep`'s login call — writing a
   plaintext password to localStorage, even briefly, is a materially
   different and worse risk than persisting a short-lived access token
   (see `authStore.ts`'s note above), and holding the line here was a
   deliberate choice, not an oversight. Practical effect: a reload in the
   ~1–2 second window between verify-email succeeding and auto-login
   completing loses the password, and `AutoLoginStep` falls back to
   pointing at `/login` rather than silently failing.
2. **Deferred submission stops at Owner Account, not further back.** Asked
   directly and confirmed: account creation (Owner Account Form + email
   verification) stays an immediate step; everything from Organization
   Structure onward defers. Structurally required, not a compromise — you
   can't verify an email for an account that doesn't exist yet.
3. **A failed "Finish" doesn't roll back partial backend state**, by
   design, not by gap — retrying is supposed to continue from wherever it
   stopped (see Delivered above), which specifically requires *not*
   undoing what already succeeded.

### Verified
`npm run lint` and `npx tsc --noEmit` both clean (frontend and backend).
Extensive live Playwright testing targeting the actual reported failure
modes, not just the happy path: confirmed zero `configure-mode`/branch/
room-type/rooms API calls fire before "Finish" is clicked; went back from
Room Type all the way to Organization Structure and forward again,
confirming both the brand-mode choice and the Branch Setup field values
survived; went back to an already-registered Owner Account Form, confirmed
it renders read-only, and confirmed clicking "Continue" from there advances
without attempting (and failing) a re-submit; reloaded mid-wizard on
Branch Setup and again on Review, confirming the correct step and all
prior data survived both times (checked `localStorage` directly, not just
the rendered page); ran "Finish" end to end and confirmed every resource
(brand, branch, room type, 3 rooms) actually exists in Postgres afterward,
querying with the tenant's RLS context explicitly set — not just trusting
that the API calls returned 2xx.

### Carried forward
- Real backward-editing for Owner Account fields (subdomain, email, etc.)
  once already created — no backend "update account" endpoint exists;
  currently read-only-and-continue only, not edit-and-resubmit.
- A Zustand+persist/Next.js SSR hydration nuance: the very first client
  render after a hard navigation briefly shows the store's un-hydrated
  initial state before localStorage loads — didn't surface as a visible
  bug in testing, but was reported directly the same day. **Fixed — see
  Phase 8's `useHasHydrated` entry.**
- Discussion in progress with the user: whether `User.email` should become
  globally unique (not just unique per tenant, `@@unique([tenantId,
  email])` today) so login could work by email alone, dropping the
  subdomain field from `/login` entirely. Explicitly deferred until this
  phase's work was done — not started.

## Phase 8 — Hydration-flash fix + full cleanup pass (2026-08-23)

Two things in one sitting: the SSR-hydration flash Phase 7 carried
forward, reported directly the same day it was written down ("I see a
brief create-your-account screen on reload"), and a full audit of the
codebase for drift accumulated across Phases 3–7 (dead code, stale
comments/docs, `wizardStore.reset()`/`authStore.clear()` written but never
actually wired to anything).

### Delivered
- **`lib/useHasHydrated.ts`** (new) — the fix for Phase 7's carried-forward
  hydration nuance. `persist`-wrapped Zustand stores (`wizardStore`,
  `authStore`) read `localStorage` asynchronously, after the first render;
  without a guard, `app/signup/page.tsx` briefly rendered the store's
  *un-hydrated* initial state (`mode === null`, the demo/real choice
  screen) before snapping to the real persisted step. Always starts
  `false` on both the server and the client's first render (so server and
  client agree — no hydration *mismatch*), only ever flips `true` inside
  `useEffect`. The first version instead read `store.persist.hasHydrated()`
  in a lazy `useState` initializer — crashed SSR outright
  (`Cannot read properties of undefined (reading 'hasHydrated')`, since
  `store.persist` isn't set up yet during the server render pass) and hit
  the `react-hooks/set-state-in-effect` lint rule. Fixed by deferring the
  read into a `queueMicrotask()` inside `useEffect` instead — resolves on
  the next microtask either way, since the store's synchronous
  `localStorage` read already happened at module-load time by the time any
  component mounts. `app/signup/page.tsx` and `app/login/page.tsx` both
  gate their first real render on it now (`wizardHydrated`/`authHydrated`).
- **Full-codebase cleanup pass** (a dedicated read-only audit agent, then
  each finding triaged and fixed by hand, not applied blind):
  - `wizardStore`'s `tenantId` field deleted — written by `ReviewStep` but
    never read anywhere; `authStore.user.tenantId` is the actual value in
    use everywhere else. Write-only state is a real bug class (silently
    drifts from whatever it was supposed to mirror), not just unused code.
  - `Select.tsx`'s hint and error were still mutually exclusive
    (`error ? errorText : hint`) — the same bug already fixed on `Input` in
    Phase 5 for the identical reason, just never carried over to `Select`
    when it was rewritten into a combobox. Also fixed `aria-describedby` to
    reference both ids, not just whichever one happened to render.
  - `wizardStore.reset()` and `authStore.clear()` existed since Phase 3/7
    but nothing ever called either — `CompleteStep` now has a real "Start
    a new signup" button wired to both, so finishing the wizard once
    doesn't permanently strand `localStorage` on `step: 'complete'`.
  - Doc/comment drift from Phase 7's data-model change: `WizardShell.tsx`'s
    header comment still said "~10 internal steps" and mentioned the
    deleted `create-brand` step; `06-state-management.md`,
    `04-components/buttons.md`, `04-components/forms.md`'s `Select` entry,
    `BrandRadioCard.tsx`'s own comment, and `register.dto.ts`'s Swagger
    example (`DELETE /tenants/:id` → the actual `DELETE /tenants/me`) all
    had the same kind of staleness — each corrected to match current
    behavior, not rewritten wholesale.
  - `README.md` had a stale "no env vars needed" paragraph, in a repo that
    has needed `NEXT_PUBLIC_API_URL` since Phase 2 and
    `NEXT_PUBLIC_LANDING_URL` since Phase 7 — replaced with a real table.

### Decisions & deviations
1. **PHASE_NOTES.md's own Phase 5 entry still mentions the (now-deleted)
   `create-brand` step** — left as-is, deliberately. This file is a build
   log, not living documentation; correcting past entries to match the
   present would make it lie about what Phase 5 actually shipped at the
   time. `06-state-management.md`/`WizardShell.tsx`/etc. describe *current*
   behavior, so those got fixed; this file describes *history*.
2. **The register-rate-limit finding wasn't a bug.** Verifying "Start a new
   signup" hit `429 Too Many Requests` on `/auth/register` — traced to
   Phase 2's own `@nestjs/throttler` limit (5 requests/15 min), reached
   from this session's own volume of test registrations, not a real
   defect. Verified the fix a different way instead of waiting out the
   throttle window: seeded `localStorage` directly (`roomick-signup-draft`
   at `step: 'complete'` + a fake `roomick-auth` token) rather than driving
   a fresh registration through the UI, then drove the actual "Start a new
   signup" click and confirmed both stores reset and the demo/real choice
   screen re-renders. Exercises the same code path (`reset()` + `clear()`
   and the components that read their output) without needing a real
   account.

### Verified
`npm run lint` and `npx tsc --noEmit` clean (frontend and backend) after
the cleanup pass. Hydration fix verified by sampling the DOM every 100ms
across a full page reload — zero frames show the demo/real choice screen
before the real persisted step renders. `useHasHydrated` confirmed to not
crash SSR (a full page load, not just client-side navigation, is the actual
test — client-side nav never exercised the crashing path). "Start a new
signup" verified via the seeded-localStorage approach above: wizard step
resets to `register`, `mode`/`owner` clear to `null`, `authStore`'s
`accessToken`/`user` clear to `null`, and the demo/real choice screen
re-renders.

### Carried forward
- Real backward-editing for Owner Account fields once already created —
  unchanged from Phase 7.
- Email-global-uniqueness discussion — still deferred, not started.
- Encryption at rest for sensitive fields — still deferred, not started.

## Phase 9 — Stale dev-server cache, phone formatting, and closing the autosave gap (2026-08-23)

### Delivered
- **Root-caused a real "Next.js recoverable error" the owner hit directly**:
  `Cannot read properties of undefined (reading 'hasHydrated')` inside
  `useHasHydrated.ts` — the exact crash Phase 8 already fixed in source, but
  the browser was still being served a stale Turbopack build. Cause: an
  orphaned `next dev` process from earlier in this session had been left
  running and squatting port 3000 (meant for the backend) since before the
  Phase 8 fix landed, and its `.next/dev` build cache/lock file survived a
  plain `taskkill`. Fixed by killing the orphan, deleting `.next` entirely,
  and restarting both dev servers clean — confirmed with a real Playwright
  load + reload against the fresh build: zero console/page errors. Not a
  code bug; this file's own "Process hygiene" lesson (kill dev servers
  between sessions, don't let orphans accumulate) is the actual fix.
- **Phone number: country-calling-code prefix + live formatting.**
  `lib/phone.ts` (new, `libphonenumber-js` — hand-rolling E.164/AsYouType
  formatting correctly isn't realistic; this is the standard library for
  it). `Input` gained an optional `prefix` slot (a fixed `+234` badge, not
  part of the editable value) for this and reused the reference's Country
  field to derive it — no second "phone country" picker. `RegisterForm`'s
  Phone field is now RHF-`Controller`-driven: the visible value is grouped
  national digits (`AsYouType`, re-derived fresh on every keystroke, not
  patched in place — the only approach that stays correct through mid-value
  edits), the value actually validated/submitted/stored is canonical E.164
  (`+2348031234567`), comfortably inside `RegisterDto.phone`'s existing
  `@MaxLength(20)` — no backend change needed. Read-only views
  (`AlreadyRegistered`) format the stored E.164 back to international
  display via the same library.
- **Closed the last "reload loses data" gap: live-typing autosave, not just
  on-submit.** Every deferred-submission step (Organization Structure
  onward, see Phase 7) already saved to `wizardStore` — but only once the
  step was actually submitted; a reload while still mid-form (before
  clicking Continue) lost whatever hadn't been submitted yet, since RHF
  only holds live keystrokes in that form's own local state until then.
  `lib/useAutosaveDraft.ts` (new) subscribes to each form's `watch()` and
  mirrors every change into `wizardStore`, debounced (400ms) — wired into
  `BranchSetupForm`, `RoomTypeForm`, `RoomsForm`, `StaffInviteStep`. The
  Owner Account form needed one more piece since it's the one step that
  still submits immediately: a new `wizardStore.registerDraft` field holds
  its *pre-submission* draft specifically (separate from `owner`, which
  means "the account was actually created with these values" and drives
  `RegisterForm`'s read-only mode — conflating the two would make an
  unsubmitted, half-typed edit look like a real account exists).
  `registerDraft` excludes `password` the same way the persisted store
  always has (`stripPassword()`, explicit field-by-field, not a destructure-
  and-omit that could silently start including a future field by accident).
  `OrgStructureForm` needed no change — its single radio pick already wrote
  to `wizardStore` immediately on click, not on a later submit.

### Decisions & deviations
1. **`AsYouType(country).input(digits)` alone doesn't group every
   country's number correctly without a leading trunk digit.** Verified
   directly (not assumed): Nigeria's *national* format template only
   activates once a leading "0" is typed (`AsYouType('NG').input('803...')`
   returns the digits back ungrouped; with a leading "0" it groups
   correctly). Since the calling code is already shown as a separate badge
   here — the owner never types the trunk "0" or the "+234" — the fix is to
   always format through the *international* template instead
   (`AsYouType().input('+234' + digits)`, which groups reliably), then
   strip the `+234 ` prefix back off before displaying it. A leading "0" is
   still tolerated and stripped if someone types one out of habit.
2. **Resuming a saved `registerDraft`'s phone needed a different formatting
   path than live typing does** (`displayFromE164`, not
   `formatPhoneAsYouType` directly) — the saved value is already canonical
   E.164 (`+2348031234567`), and re-feeding that same string through the
   live-typing formatter double-counts the calling code (parses it as
   "international input", producing `+234 803 123 4567` inside the field on
   top of the separate `+234` badge). `displayFromE164` recovers just the
   national significant number via `parsePhoneNumberFromString` first, then
   reuses the same grouping logic. Caught by actually reloading a seeded
   draft and looking at the rendered field, not assumed correct because the
   live-typing path worked.
3. **A trunk "0" is stripped unconditionally when a calling code is known,
   not just for Nigeria.** Leading-zero national trunk prefixes are the
   most common convention globally (also true for the UK, Germany, France,
   and others); no real number is lost by stripping it since it's implied
   by the calling code being shown separately either way.

### Verified
`npm run lint` and `npx tsc --noEmit` clean (frontend); `npx tsc --noEmit`
clean (backend, after reverting an unrelated stray `tsconfig.json` edit
found sitting uncommitted — not part of this or any prior session's actual
work, discarded rather than carried forward). Live Playwright runs: (1) a
full clean-cache load + reload of `/signup` with zero console/page errors,
confirming the hydration crash is gone; (2) typed into the Owner Account
form (name, country, phone, group name), waited past the debounce, reloaded
— every field including the phone (grouped display + `+234` badge)
resumed correctly; (3) seeded a mid-`branch-setup` draft, typed into two
fields without submitting, reloaded — both fields resumed; (4) one real
registration through the actual UI (not a direct API call) with a Nigerian
phone number, confirmed via a direct Prisma query — with the tenant's RLS
context explicitly set, not an unscoped query that would silently return
nothing — that `phone` persisted as `+2348031234567` and `country` as
`'NG'`.

### Carried forward
- Everything else already carried forward from Phase 8 — unchanged.

## Phase 10 — Log in and continue where you left off (2026-08-23)

A returning owner hitting `SUBDOMAIN_TAKEN`/`EMAIL_TAKEN` on a fresh browser
session (no local `wizardStore` memory that the account already exists) had
no way forward except a dead-end field error — reported directly, alongside
a phone-field bug ("the leading 0 should be stripped after leaving focus")
found investigating it, and a real stale-dev-server-cache issue that turned
out to be why an earlier report ("can't navigate to next step") looked like
a code bug and wasn't.

### Delivered
- **`RegisterForm`'s conflict handling now offers a real path forward, not
  just an error.** Catching `SUBDOMAIN_TAKEN` or `EMAIL_TAKEN` sets a new
  `conflict` state (the email/password/subdomain just submitted) and shows
  "Log in and continue where I left off" alongside the existing field
  error. Clicking it calls `authStore.login()` with those exact values —
  which *is* the "do these details actually match a real account" check: a
  wrong password fails with the same `INVALID_CREDENTIALS` text `/login`
  itself would show, and an unverified account correctly fails closed with
  `EMAIL_NOT_VERIFIED` (verified live, not assumed — see below). This can't
  be used to probe whether someone else's account exists.
- **`lib/resumeOnboarding.ts`** (new) — once logged in, calls the backend's
  new `GET /tenants/me/onboarding-status` (see
  `roomick-pms-backend/PHASE_NOTES.md`) and maps its response onto a
  `wizardStore` patch: rehydrates `owner` (from `Tenant`/`User` columns —
  `User.name` is one column, split back into first/last on a best-effort
  basis, first space-separated token vs. the rest, since the original split
  was never stored), and walks brand → branch → room type → rooms exactly
  like the probe does, landing `step` at the first thing that's actually
  missing (`org-structure` with nothing yet, all the way to `review` if
  rooms already exist). No `onNext()` call in this path — `wizardStore.step`
  is what actually drives `page.tsx`'s render, and it's essentially never
  `verify` from here (logging in already proves the email is verified).
- **Fixed: phone field showing the raw typed/autofilled text (leading `0`
  included) instead of the live-formatted value.** The `onChange`-based
  `AsYouType` formatting (Phase 9) works correctly for real typing and
  paste, confirmed directly — but a browser autofill can set an `<input>`'s
  value in a way that doesn't reliably fire it, leaving the DOM showing
  whatever was autofilled, untouched. Added an `onBlur` handler that
  re-normalizes straight from the live DOM value (not the last known
  `field.value`, which could be equally stale if `onChange` never fired) —
  this both fixes the reported bug and is literally what was asked for
  ("the leading 0 should be removed automatically after leaving focus").
- **Root-caused the "still can't navigate to the next step" report as a
  second stale-dev-server-cache symptom, not a new bug** — the same class
  of issue Phase 9 already found and fixed once, recurring because the
  browser tab reporting it had stayed open across yet another dev-server
  restart. Confirmed by testing the exact reported flow (fill Branch Setup,
  reload, click Continue, click a sidebar phase link) fresh against the
  live server with zero errors; the fix was a hard refresh on the stale
  tab, not a code change.

### Decisions & deviations
1. **A purpose-built backend endpoint, not three generic list endpoints.**
   See the backend's own `PHASE_NOTES.md` entry for the reasoning — this
   flow needs exactly one thing (how far did onboarding get), not a
   reusable "list branches for a brand" API that doesn't exist yet either.
2. **The resumed `rooms` draft is a placeholder (`{ from: 1, to:
   roomCount }`), not a reconstruction of whatever range actually created
   those rooms.** Review only uses it to compute a display count and to
   satisfy its own "did every step finish" render guard
   (`if (!branch || !roomType || !rooms) return null`); Finish's real
   guard against re-creating rooms is `createdRoomCount === 0`, already
   populated from the real count — the placeholder's numbers are never
   submitted to the backend.
3. **Staff invites are not resumed.** The probe doesn't query sent invites
   (no backend endpoint lists them either), and re-offering the staff
   invite step on resume is harmless — it's additive, not something
   Finish would otherwise conflict on re-running.

### Verified
`npm run lint` and `npx tsc --noEmit` clean (frontend and backend). Backend
probe endpoint checked directly via real API calls at both extremes — a
freshly verified tenant with nothing else yet, and the same tenant after
really creating a brand/branch/room type/5 rooms — confirming the exact
response shape `resumeOnboardingDraft` expects. The UI side (conflict
detected → resume button shown) confirmed via a real duplicate-registration
attempt against a live account. The login-side safety check confirmed
directly: attempting to resume with an *unverified* account correctly fails
with `EMAIL_NOT_VERIFIED` and leaves `wizardStore` untouched — logging in
first is a real gate, not a formality. Phone-blur fix confirmed by
simulating a native (non-React-event) DOM value set, matching how a browser
autofill actually behaves, then checking the field re-formats correctly on
blur.

### Carried forward
- Real edit/re-submit semantics for Owner Account fields once already
  created — unchanged from Phase 7/8; resuming reads existing values, it
  still doesn't let you change them.
- Email-global-uniqueness discussion, encryption at rest — still deferred,
  unchanged.

## Phase 11 — Country-derived Timezone/Currency, Branch Setup's Country as a real dropdown (2026-08-23)

### Delivered
- **`BranchSetupForm`'s Country field is now a real dropdown** (`Select` +
  `lib/countries.ts`, the same static list `RegisterForm`'s Country field
  already uses), not free text — caught directly: typing "Nigeria" into
  the old free-text field failed `branchSetupSchema`'s 2-letter-code
  validation, a real usability trap for anyone who doesn't already know to
  type "NG".
- **Timezone and Currency removed from this form entirely** — both are now
  derived silently from whichever Country is picked
  (`lib/timezones.ts`/`lib/currencies.ts`, two new static per-country
  lookup tables, same "small static dataset, no network dependency"
  pattern as `lib/countries.ts`) and written straight into the form's state
  via `setValue`, with no input for either. Direct request: asking
  separately for two things a country selection already implies was
  judged unnecessary friction, matching the same philosophy behind the
  auto-suggested subdomain.

### Decisions & deviations
1. **Currency is a safe silent default for nearly every country** — one
   official currency each (eurozone members all map to `EUR`); no real
   accuracy trade-off is being made by not showing a field for it.
2. **Timezone is a genuine, accepted trade-off, not a safe one** —
   confirmed directly against the schema (`Branch.timezone`'s own comment:
   "IANA tz — night audit depends on it") that this is operationally
   load-bearing, not cosmetic, and that it's correctly modeled at the
   *branch* level, not brand or tenant (`grep`ped the whole schema — no
   `timezone` column exists anywhere except `Branch`), so one brand with
   properties in different real-world timezones was never at risk from
   this change. A multi-timezone country (the US, Russia, Canada, ...)
   still gets one representative zone with no way to correct it from this
   screen — accepted as-is, a real product decision made explicitly, not
   a bug. `defaultTimezoneFor`/`defaultCurrencyFor` both have confirmed
   100% coverage against every code in `lib/countries.ts` (scripted check,
   not eyeballed) — the "derive silently" design only holds together if
   there's no code that quietly falls through to an empty value.
3. **`branchSetupSchema`'s `timezone`/`currency` fields are unchanged** —
   still required strings the backend DTO expects; only the *UI* for them
   was removed. Validation still runs on submit exactly as before, it's
   just now certain to already be filled in by the time Country itself
   validates as chosen (`country` is a required, non-optional field in the
   same schema).

### Verified
`npm run lint` and `npx tsc --noEmit` clean. Live Playwright check:
selecting a country writes both a correctly-grouped display value nowhere
visible on screen but a real `timezone`/`currency` pair into the saved
draft (`Africa/Lagos`/`NGN` for Nigeria, confirmed by reading
`wizardStore`'s persisted state directly, not just trusting the code) —
and the form still advances cleanly with zero validation errors on submit.

### Carried forward
- Everything else already carried forward from Phase 10 — unchanged.

## Phase 12 — Timezone dropdown, sub-step Back navigation, rate/amenity field fixes, fixed sidebar (2026-08-23)

### Delivered
- **Timezone is a real dropdown again, scoped to the selected Country** —
  `lib/timezones.ts`'s new `timezoneOptionsFor()`: every real IANA zone for
  the ~15 countries that genuinely span more than one (US, Russia, Canada,
  Australia, Brazil, Mexico, Indonesia, DRC, Kazakhstan, Mongolia, Chile,
  Ecuador, Portugal, Spain, New Zealand, Kiribati), pre-selected to that
  country's most-populous zone but freely correctable from the same list.
  Direct follow-up to Phase 11 hiding it entirely — that traded away real
  correctness for multi-timezone countries; this keeps Currency silent
  (still a safe default almost everywhere) but gives Timezone back its own
  field since it's night-audit-critical and the trade-off wasn't actually
  safe there.
- **Back buttons on every sub-step inside the "Branch Setup" sidebar
  phase** (`BranchSetupForm` → `RoomTypeForm` → `RoomsForm` →
  `StaffInviteStep` → `ReviewStep`) — reported directly: these four+
  internal steps all collapse into one sidebar entry (see `WizardShell`'s
  header comment), so once past Branch Setup there was no way back to fix
  something without the sidebar's own back-navigation, which only jumps to
  a *phase's* first step, not the specific sub-step just left. Safe by
  construction, not just convenient — every one of these steps is pure
  local `wizardStore` state until Review's "Finish" (Phase 7), so going
  back is never re-triggering a real backend call.
- **`Base Nightly Rate` prefixed with the branch's own currency symbol**
  (`lib/currencies.ts`'s new `currencySymbolFor()`, via `Intl.NumberFormat`
  — not a second ~190-row hand-authored table; falls back to the plain
  code for currencies CLDR's `en` locale doesn't define a distinct glyph
  for, e.g. `NGN`/`ZAR`/`KES`, which is correct, not a gap). `Input`
  gained a `suffix` prop (mirroring the existing `prefix` slot from Phase
  9's phone field) for the second half of this batch: `Room Size` relabeled
  to "Room Size (in square meters)" with a live `m²` suffix, removing the
  now-redundant "Square meters, optional" hint.
- **Fixed: `MultiSelectTagInput`'s Amenities field advertised "pick from
  common amenities or type your own" but only the typing half actually
  existed.** `allowCustom={true}` rendered the free-text input/Add button
  only — `options` was accepted as a prop and used to resolve chip labels,
  but never rendered as anything pickable. Now shows both together: the
  free-text row plus a "Pick from common options" trigger reusing the same
  checklist UI the dropdown-only mode already had, each fully accessible on
  its own (the trigger gets its own id/`aria-label` in combined mode
  instead of duplicating the free-text field's hint/error announcement).
- **The wizard's sidebar is genuinely fixed now, not just visually
  static.** First attempt was a plain `sticky top-0` — didn't hold up
  (verified live, not assumed): the flex row's default `align-items:
  stretch` stretches `aside` to match `main`'s full height, leaving a
  sticky element with no scroll range to ever "catch" on. Replaced with the
  standard app-shell pattern instead: the whole shell is capped to
  `h-screen`/`overflow-hidden` (the browser window itself never scrolls),
  and `main` alone gets `overflow-y-auto` — sidebar *and* header both stay
  visually fixed, only the step content scrolls, confirmed by directly
  reading `main`'s `scrollTop` and the sidebar's bounding box before/after
  a scroll (identical, not just "close").

### Decisions & deviations
1. **Currency still has no field of its own, only Timezone got one back.**
   Re-confirmed the asymmetry is real, not an oversight: one official
   currency per country covers nearly every case, but several countries
   genuinely operate more than one real timezone — "derive silently" was
   never a safe trade-off for the second one.
2. **The currency-symbol/room-size-suffix work only touches
   `RoomTypeForm`** — the only screen in the wizard with a rate field or a
   size-in-a-unit field; nothing else needed the new `Input` `suffix` prop
   or `currencySymbolFor` this pass.

### Verified
`npm run lint` and `npx tsc --noEmit` clean throughout (one unrelated `tsc`
run hit a Node/V8 native crash mid-batch — re-ran clean immediately after;
not a real compiler error, and lint had already passed in the same batch).
Live Playwright checks for every item above: US timezone dropdown shows 7
real zone options and a manual pick (Denver) survives; switching to a
single-zone country (Nigeria) correctly resets to its one option; the
full Branch Setup → Room Type → Rooms flow still submits cleanly end to
end; the amenities picker both adds a predefined option (Wi-Fi, via the
new trigger) and a typed custom one (Rooftop pool) into the same chip
list; the sidebar's bounding box is byte-for-byte identical before and
after scrolling `main` by 300px, with the header still visible throughout.

### Carried forward
- **Multiple branches per organization, multiple room types per branch,
  and a richer individual-room-card + bulk-"Generate" Rooms screen** —
  requested directly, mid-session, not yet started. This is the "Full"
  onboarding mode already flagged as deferred since Phase 3 (buildings/
  floors, more than one room type/room batch) — a real data-model change
  (`wizardStore.branch`/`roomType` go from a single object each to arrays,
  Review's "Finish" chain needs to loop, not call once per resource type)
  and UI rebuild, not a quick add. Needs its own scoping pass before
  implementation, same as every other multi-step architecture change this
  session paused for first (deferred submission, the resume-onboarding
  flow) rather than guessing at the shape from a short description.
  **Delivered — see Phase 13.**
- Everything else already carried forward from Phase 11 — unchanged.

## Phase 13 — "Full" onboarding mode: multiple branches, buildings/floors, multiple room types, room cards + Generate (2026-08-23)

The deferred item from Phase 12: built with a real plan first (`EnterPlanMode`, approved before any code), after re-reading `references/Roomick-UI.pdf` pages 3–8 in full — a direct correction that the earlier scoping question had already been answered by the references, not something to re-derive from one screenshot. Every prior phase of this wizard used the backend's "Rooms Only" shortcut (one implicit brand/branch/room type/room batch, hidden default building+floor); this replaces that with the real thing.

### Delivered
- **`wizardStore.branches: BranchDraft[]`** replaces the old singular `branch`/`roomType`/`rooms` fields entirely. Every node (branch, room type, building, floor, room card) carries a client-generated `localId` plus a `id: string | null` written the moment Finish actually creates it — the same "retry only creates what's still missing" pattern Phase 7 established for the single-branch case, now applied per-node at every level of the tree.
- **`WizardShell`'s sidebar is a real expandable tree** for the "Branch Setup" phase now: Branch → Room Types / Buildings → Floors, matching the reference exactly, with "+ Add branch"/"+ Add building" and per-branch "×" remove. Only the *active* branch's buildings auto-expand (matching the reference screenshot itself — "Main Building" expanded, "Annex" and the second branch collapsed), driven by where the wizard actually is, not separate UI state.
- **New `BuildingsFloorsForm.tsx`** — one building at a time (`useFieldArray`, "+ Add building"), each with a Single/Multiple-Floors toggle and a plain floor-count stepper (not individually-named floors — the reference never shows a per-floor name field either, just a count) and a Views tag input.
- **`RoomTypeForm.tsx` converted to a repeatable list** (`useFieldArray`, "+ Add room type", same pattern `StaffInviteStep` already used for invite rows) — every existing field per card unchanged.
- **`RoomsForm.tsx` redesigned around individual room cards + a "Generate" pattern modal**, matching the reference's "Room 1/2/3/4" cards and "Setup Pattern" popup exactly: each card is Room Type (dropdown, sourced from the branch's configured room types) + Room Number + View; "+ Add room" appends one blank card, "+ Generate" opens the new **`components/ui/Modal.tsx`** (first modal primitive in this app — hand-rolled, not headless-UI, same rigor as `Select.tsx`'s listbox: focus trap, Escape-to-close, `role="dialog"`) with Room Type/Starting Number/Count/View/Increment Pattern, computing a batch of cards client-side (still deferred submission — nothing hits the backend until Finish).
- **`ReviewStep.tsx` restructured**: paginated per branch (← Previous / Next →, matching the reference), each page showing that branch's room types and a Buildings → Floors → room-count breakdown. Finish's chain now walks the full tree per branch — room types, then buildings, then each building's floors, then every not-yet-created room card **grouped by (floor, room type, view)** into one `rooms/bulk` call per group (`numbers`, not `range` — see decision 2) — verified live to actually fire as separate calls when views differ on the same floor, not one call per branch.

### Decisions & deviations
1. **Room Types stay branch-scoped, not per-building**, despite the reference framing its own breadcrumb/heading around a specific building ("Set up room types for Main Building"). Checked directly, not assumed: `RoomType.branchId` (grepped the schema) and the DB reference doc's own stated hierarchy — "Brand → Branch → Building → Floor → Room", Room Types aren't in that chain — both put it at the branch level. A building-scoped tree row here would be a fake distinction with nothing backing it in storage; the tree instead shows "Room Types" as a sibling of a branch's buildings, not nested under one. A fourth reference/backend mismatch of the same shape already logged in Phases 2–3.
2. **The "Increment Pattern" field (+1, +2, ...) and per-card View are both handled purely client-side, no backend change.** `BulkCreateRoomsDto`'s `range` variant is a plain contiguous from/to (no skip-pattern support) and takes one `view` for the whole call — the modal computes the exact `numbers: string[]` array itself (so any increment works) and `ReviewStep`'s Finish groups cards by `(floor, room type, view)` before calling the endpoint, issuing one call per distinct group. Confirmed live: a floor with a plain room plus a 3-room "sea view" generated batch produced exactly two `rooms/bulk` calls, not one.
3. **Staff Invite and Review stay singular, not per-branch.** The reference shows Staff Invite once per onboarding pass; making it per-branch would need `staffInvites` nested per branch too — a further data-model change the actual request ("multiple branches and room types") didn't ask for. The *first* branch created is the one Finish sends any invites against; a branch added later via the sidebar's "+ Add branch" skips straight from its own Rooms step back to Review instead of revisiting Staff Invite.
4. **`resumeOnboardingDraft.ts` ("log in and continue where you left off", Phase 10) still only reconstructs one branch, with no buildings/floors and no individual room cards** — `GET /tenants/me/onboarding-status` was built before this phase existed and only reports a single branch/room-type pair plus a room *count*, not a tree. A returning owner past the Rooms step resumes onto Review showing that branch's room type but an empty Buildings section and a local room count of 0, even though real rooms exist on the backend — cosmetically wrong, not functionally unsafe (Finish's per-node `if (!id)` guards mean nothing gets recreated, since there are no local room cards to resubmit). Extending the probe endpoint to return the full tree is real, separate backend work, flagged here rather than attempted.
5. **The mockup's fully paginated Review (separate Owner Info / Organization Structure sub-pages, each with their own Back/Next)** — not built; those two sections stay the single-page summaries they already were. Only the Branches section became paginated.

### Verified
`npm run lint` and `npx tsc --noEmit` clean throughout. Live Playwright pass building the exact scenario from the plan's own verification section: two branches, one multi-building (Main Building × 3 floors, Annex × 1 floor), two room types (Standard, Deluxe), a manually-added room card plus a Generate pattern with a +2 increment on the same floor (confirmed the resulting numbers: 101, 103, 105, alongside the manual one — a real bug caught and fixed here, see below), automatic floor-to-floor advancement, the first branch routing to Staff Invite while a second (sidebar-added) branch skips straight to Review, sidebar navigation back to a specific branch's Room Types showing that branch's own list, and Review's branch pager appearing only once there are 2+ branches. Separately, one full real "Finish" run against the live backend + local Postgres (not a mock): registered a fresh account, built one branch/building/floor/room type/4 rooms (a plain card plus a 3-room "sea view" generated batch), clicked Finish, and confirmed via a direct Prisma query with the tenant's RLS context explicitly set — not just trusting 2xx responses — that the branch, building, floor, room type, and all 4 rooms (with the correct split between `view: null` and `view: 'sea'`) exist exactly as expected, generated via two separate `rooms/bulk` calls as designed.

**Real bug caught during this verification, not before shipping**: `RoomsForm`'s "Generate" handler read `useFieldArray`'s `fields` array to preserve already-typed room cards when merging in a freshly generated batch — `fields` only tracks array *structure* (add/remove/reorder), not the live value of each row's own uncontrolled (`register()`-bound) input, so a manually-typed room number was silently dropped the moment Generate ran. Fixed by reading `getValues('rooms')` at the moment of merging instead — confirmed by literally typing a room number, clicking Generate, and checking the room actually survived (before: `['101','103','105']`, missing the typed one; after: `['001','101','103','105']`).

### Carried forward
- `resumeOnboardingDraft.ts`'s single-branch/no-tree limitation — see decision 4.
- Everything else already carried forward from Phase 12 — unchanged.

## Phase 14 — Live UX polish across the new "Full" mode screens, room-number uniqueness guard (2026-08-23)

A round of direct feedback on Phase 13's screens, live: comma-formatted rates, title-cased free-text fields, a real "glass" modal, spacing/alignment fixes, and three real bugs on the Rooms screen — duplicate numbers being creatable at all, a stuck validation warning, and room-card state bleeding across floors.

### Delivered
- **Subdomain field collapsed to a one-line summary by default** (`RegisterForm`) — the deferred subdomain-UX discussion, resolved: *"Your login id will be `grand-lagos-hotel` — customize"*, expanding to the full editable field only on click (or automatically if it already has a validation error). Kept as a real, correctable field rather than removed entirely — it's still the actual `/login` identifier, not just a cosmetic slug (Phase 10's resume flow depends on it being right).
- **`Select`'s trigger gets `cursor-pointer`** — it's a dropdown, native text inputs default to a text cursor, which read as non-interactive.
- **New `CurrencyInput`** (`components/ui/CurrencyInput.tsx`) — live thousands-separator formatting (`30000` → `30,000`) on Base Nightly Rate. Native `<input type="number">` can't show this at all (the browser strips commas outright), so this is a controlled text field with `inputMode="decimal"`, same trade-off `RegisterForm`'s phone field already made. `lib/numberFormat.ts`'s `formatWithCommas`/`displayWithCommas` do the actual formatting, reused in `ReviewStep`'s Base Rate row too.
- **New `lib/textFormat.ts`'s `toTitleCase`** — "king size bed" → "King Size Bed", applied to Bed Type (on blur, not every keystroke — normalizing mid-word would be disruptive) and to custom-typed Amenities/Views tags (`MultiSelectTagInput` gained an optional `formatTag` prop, applied the moment a custom tag is added). Deliberately *not* applied to names (hotel/brand/branch/building) — forcing a stylized name into title case could be actively wrong.
- **`MultiSelectTagInput`'s "Pick from common options" trigger restyled** to match `Select.tsx`'s own trigger — a chevron icon, proper spacing from the free-text row above it, and (direct correction, saved to memory) no `text-accent`/`border-accent` on it: accent is reserved for non-interactive detail/review cards in this design system, never for anything actually clickable.
- **Selected-option styling centralized**: `Select.tsx` now exports `SELECTED_OPTION_CLASSES`/`UNSELECTED_OPTION_CLASSES` (space between rows, `bg-secondary-light/20`, a `border-secondary` outline — tuned down from an initial `/50` per direct feedback), and `MultiSelectTagInput` imports and reuses them rather than keeping a second, separately-tuned copy.
- **Room card rows realigned** (`RoomsForm`) — labels (Room Type / Room Number / View) now sit on one line regardless of which field has a hint pushing its own box taller; `items-end` was quietly aligning by each field's *bottom*, not its label.
- **Room card View is a dropdown sourced from that room's building's configured Views**, not free text — matches the actual data relationship (`BuildingDraft.views`, set once in Buildings/Floors) instead of re-typing the same view string per room. A leading "No view" option keeps it genuinely optional. The Setup Pattern modal's View field got the same treatment.
- **Modal gets a real "glass" treatment** (`components/ui/Modal.tsx`) — `backdrop-blur-xs` on the overlay, `bg-white/90 backdrop-blur-sm` with a solid white border on the panel, matching the reference mockup's own modal look (a few rounds of live tuning: less blur, a visible white border instead of a barely-there one, more panel opacity once background content was reading as distracting through it).
- **Room card row spacing** (`RoomsForm`) — gap between the Room Type / Room Number / View fields on each row widened (`gap-3` → `gap-6`). An earlier attempt misread "add space between them" as the *dropdown's own* open-listbox spacing and widened that instead (`gap-1` → `gap-2` in `Select.tsx`/`MultiSelectTagInput.tsx`); reverted once it was clarified the request was about the inline fields, not the listbox.
- **Sidebar's active tree row text is white** (`WizardShell`'s `TreeRow`) — was `text-secondary`, unreadable against the row's own `bg-primary` active-state fill.
- **Fixed: duplicate room numbers — three separate bugs, not one.**
  1. Nothing stopped the same number being typed twice, same floor or a different one — now checked live as it's typed (every row re-derived from the live form values on each render, not just on blur/touch), and again at submit as the final gate before anything saves.
  2. The Setup Pattern modal's own printed copy already promised "this will replace any existing rooms in this generated range", but the code just appended the new batch — generating over an already-populated range silently created duplicates instead of replacing them. Fixed to actually do what the copy says, and the modal now shows *live*, while Starting Number/Count/Increment are still being typed, exactly which existing numbers on this floor will be replaced — and separately flags any collision with a *different* floor's room, which Generate can't silently fix.
  3. Switching floors didn't remount `RoomsForm`, so RHF's `defaultValues` and field array never refreshed for the newly-selected floor — Floor 1 would show Floor 0's rooms, and deleting a row on one floor could appear to affect another. Fixed with `key={activeFloorLocalId}` on `<RoomsForm>` in `page.tsx`, forcing a clean remount (form state, field array, and the Setup Pattern modal's own state together) on every floor switch.

### Decisions & deviations
1. **Duplicate detection is plain derived state (`useMemo` over `useWatch`'s live values), not `setError`/`clearErrors` fired from a `watch` subscription.** The first version used the latter and had a real bug, caught live: RHF's own resolver-driven `onTouched` revalidation replaces the whole `errors` object on every blur/change and knows nothing about a custom "duplicate" error type, so a `clearErrors` call could win the race for one row and lose it for another — observed as a warning stuck on an already-corrected number even after a *different* row's duplicate was fixed. Deriving the flagged-row set fresh from the live values every render has no separate error state to fall out of sync with, so there's nothing left to race.
2. **Cross-floor duplicates are surfaced as an error, not silently resolved.** Generate's "replace" behavior only touches *this* floor's cards — silently deleting a room on a *different* floor because a new number happened to collide would be its own confusing surprise, worse than a clear "already used elsewhere" message the owner can act on directly.
3. **Room-number uniqueness stays branch-wide, not scoped to buildings** (asked directly, answered rather than changed). Real PMS systems key reservations/housekeeping/folios off a bare room number with no building qualifier — multi-building properties avoid collisions with distinct number ranges or prefixes per building instead of relying on the building to disambiguate. Also a real backend constraint, not just convention: `Room` has no `buildingId` (only `floorId`), and `@@unique([branchId, number])` is the actual DB constraint — building-scoping would need a schema migration for a numbering behavior that doesn't match how hotels actually do it anyway.

### Verified
`npm run lint` and `npx tsc --noEmit` clean throughout (one real ESLint error surfaced and fixed along the way: `saveToStore` was referenced before its declaration in `RoomsForm`, caught by the `react-hooks/immutability` rule — reordered, not suppressed). Live Playwright checks for every item above: typing a duplicate number into two rows flags both live (not just the second one — an intermediate version only caught the later occurrence); correcting one row's duplicate clears its warning without leaving the other stuck (the exact race described in decision 1, reproduced then confirmed fixed); the Setup Pattern modal's live preview correctly lists which existing numbers a pending Generate would replace before it's clicked; Floor 1 arrives with a clean slate after Floor 0 is saved, and deleting a row on Floor 1 leaves Floor 0's saved rooms untouched when revisited via the sidebar tree.

### Carried forward
- Everything else already carried forward from Phase 13 — unchanged.

## Phase 15 — Stale-token recovery, review-screen redesign, branch-delete confirmation, component cleanup (2026-08-23)

Already committed separately, folded in here for the record: `(fix): Stale Timezone "Required" error; accent color on interactive fields` (039ba01) — `BranchSetupForm`'s Country→Timezone/Currency auto-fill used `shouldValidate: false`, so a stale "Required" error from an earlier empty-field validation pass never cleared once the field filled itself in; and `accent` (this system's "quiet, non-interactive" token) turned out to be styling every interactive field's at-rest border/placeholder across the app — `Input`, `Select`, `Textarea`, `MultiSelectTagInput`'s free-text and picker-trigger controls, `RadioCard`, `YesNoToggle`, `LogoUpload`'s drop zone — not just the one field it was first noticed on. `Input.tsx` now exports `FIELD_PLACEHOLDER_CLASS`/`FIELD_UNDERLINE_CLASS` as the one shared source for the four underline-style fields, replacing three separately hand-copied strings that had already drifted once (that drift is exactly why this went wide instead of a one-line patch).

### Delivered (this pass)
- **Fixed: an expired access token surfaced as a raw "Unauthorized" with no recovery.** Real bug, not hypothetical — `JWT_ACCESS_TTL=900s` (15 minutes) is comfortably shorter than a multi-branch onboarding session can take to fill in and review, and `apiFetch` never used the 30-day refresh token `authStore` was already storing at login. `authStore` gained `refreshAccessToken()` (exchanges the stored refresh token via `POST /auth/refresh`, writes the new pair back, returns `null` — and clears the store — if the refresh token itself is dead); `apiFetch` now retries exactly once on a 401 that carried an access token, transparently, before surfacing anything to the caller. `authStore` is imported *dynamically* inside `apiFetch`, not statically — `authStore.ts` already imports `apiFetch`, so a static import back would be circular. Verified against the real running backend, not mocked: registered and verified a throwaway account, logged in for a genuine token pair, corrupted the stored access token, and ran the entire Finish chain (`configure-mode` → branch → room type → building → floor → rooms/bulk) — every call 401'd once, refreshed, retried, and succeeded, with real rows created and no error ever shown.
- **Branch deletion now confirms first** (`WizardShell`'s tree "×") — deleting a branch discards every building/floor/room type/room configured under it, which is real, easy-to-lose work partway through a multi-branch setup, not a trivial undo. New `components/ui/ConfirmDialog.tsx` (built on `Modal.tsx`, not a one-off) names the branch and blocks until Delete/Cancel; `Button` gained a `danger` variant (`bg-red-600`, reusing the same red this system's form errors already use, not a new invented hue) for the confirm action.
- **Review screen's cards now use `Section`'s new `tone="accent"`, not the mockup's gold** — direct correction: these are read-only recap boxes, not a field group, so they get `Card.tsx`'s `accent` tone (`bg-accent-dark/10`) instead of the pale-gold `primary` box every interactive-form `Section` still uses. `Section` took a `tone?: CardTone` prop (default `primary`, unchanged everywhere else) that reuses `CARD_TONE_CLASSES` directly rather than a hand-tuned copy. Once the cards themselves were re-toned, the label text inside them (`Row`'s label, "Floor N") still read as `text-secondary-light` — a different hue family sitting on an accent-toned card — caught live and switched to `text-accent-dark`; the *value* text stays `text-secondary` regardless of tone, matching `Card.tsx`'s own documented reasoning (values need the contrast, not a tone match).
- **Review's Buildings section now shows real room-number chips per floor, hovering/focusing/clicking one for a detail popup** (Floor, Room Type, Base Price, Room Size, Bed Type, View, Amenities) — this was in the original "Full mode" plan's Review spec but had been trimmed down to a bare `"4 rooms"` count during implementation. New `RoomChip`/`RoomDetailRow` in `ReviewStep.tsx`. Recolored off the reference here too: the mockup's chip+popup pair mixes gold and purple; both stay in the same accent/slate family as the rest of this now-`tone="accent"` screen. The popup itself is solid white (not translucent-accent) on purpose — it's a floating overlay meant to sit *above* the room grid, and a translucent card there would let the chips underneath bleed through instead of reading as a distinct layer.
- **Currency symbols resolve to the real glyph more often** (`currencySymbolFor`) — verified directly, not assumed: `Intl.NumberFormat('en', ...)` renders NGN/KES/GHS/ZAR/PKR as their bare ISO code even though `Intl` genuinely has a symbol for each; the symbol data is keyed by *region*, not just language, for a lot of non-Western currencies. Now resolves the currency's first known country from the existing `DEFAULT_CURRENCY_BY_COUNTRY` map (reversed and cached, not a second hand-authored table) and asks for `en-{country}` instead of plain `en` — confirmed empirically for the currencies this app's country list actually uses. Some currencies (EGP, THB, BDT, ETB, ...) still have no distinct glyph even region-qualified — that's `Intl`'s own answer, not a gap left by this fix.
- **`BrandRadioCard.tsx` removed.** It was already a thin wrapper delegating everything to the generic `RadioCard` primitive (a prior refactor, `Card.tsx`'s own header comment references the old hand-copied version this replaced), and `OrgStructureForm.tsx` was its only production call site — inlined there directly (`BRAND_MODE_OPTIONS` + `<RadioCard>`), matching how `BuildingsFloorsForm.tsx` and `page.tsx` already use `RadioCard` for their own choices. `BrandMode` moved from living on a UI component to `wizardStore.ts`, where it's actually consumed as a domain type.

### Verified
`npx tsc --noEmit` and `eslint` clean throughout every step above. Live Playwright checks for the confirm dialog (opens naming the right branch, Cancel leaves it, confirming removes it), the Review screen's recolor and chip popup (screenshot-checked), and currency symbols (₦ renders, not the literal string "NGN"). The token-refresh fix got the most scrutiny of this batch — see above — because it's the one item here that's silently wrong until someone happens to sit on the wizard past 15 minutes, exactly the kind of bug that doesn't show up in a quick manual click-through.

### Carried forward
- Everything else already carried forward from Phase 14 — unchanged.
