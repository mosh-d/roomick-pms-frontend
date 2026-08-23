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
