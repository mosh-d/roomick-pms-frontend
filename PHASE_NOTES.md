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

## Phase 16 — Session-recovery dead end (2026-08-23)

Found live, immediately after Phase 15's own token-refresh fix shipped: a real account got stuck on Review with a plain "Unauthorized" and no way forward, even after a hard refresh and a brand-new tab — ruling out the stale-bundle explanation that fit *every* prior "reported bug that doesn't reproduce fresh" case this session. Two real, separate gaps, not one:

1. **`ReviewStep`'s error message had nothing actionable in it.** A 401 reaching `handleFinish`'s catch block means Phase 15's own retry-refresh *already tried and failed* — the stored refresh token is genuinely dead, not just the access token — so there's nothing left for "Finish" to retry on its own. It needs a real re-login, but the screen only ever showed the raw `ApiError.message` ("Unauthorized") with no link, no explanation, nowhere to go. Now: a 401 specifically sets a distinct `sessionExpired` state instead of the generic `submitError`, rendering "Your session expired. **Log in again** — everything here is saved, so you'll land right back on this step" with a real `/login` link.
2. **`AutoLoginStep` trusted a stale flag over the actual token state.** `wizardStore.loggedIn` and `authStore`'s tokens are two independently-persisted pieces of state that can drift — Phase 15's `refreshAccessToken()` clears `authStore` on a dead refresh token, but has no way to reach into `wizardStore` and flip `loggedIn` back to `false` too (different store, no coupling between them). So a session that died mid-Review left `loggedIn` still claiming "signed in," and *if* the wizard were navigated back to `AutoLoginStep`, it would have trusted that flag, skipped the real login call, and rendered "Already signed in — nothing to redo here" — a second, quieter dead end sitting behind the first. Fixed by deriving `loggedIn` as `wizardStore.loggedIn && Boolean(authStore.accessToken)`, not the flag alone.

Confirmed the actual account was unstuck by the already-documented route: `/login` re-runs the same `authStore.login()` `AutoLoginStep` uses, `wizardStore`'s draft (branches/rooms/step) is a fully separate persisted store untouched by any of this, and `page.tsx`'s step routing reads `wizardStore.step` directly with no dependency on `loggedIn` — so signing in at `/login` and navigating back to `/signup` lands exactly back on Review with a working session, no lost progress.

### Verified
`npx tsc --noEmit` and `eslint` clean. Live Playwright checks for both fixes specifically: a branch with a dead refresh token hitting Finish shows the new "session expired" link (not the bare "Unauthorized" string, confirmed by its literal absence); `AutoLoginStep` given `loggedIn: true` but no stored access token now correctly falls through to its real "Sign in required" / "Go to login" branch instead of the stale "Already signed in" one.

### Carried forward
- Everything else already carried forward from Phase 15 — unchanged.

## Phase 17 — Silent decimal-precision validation gap (2026-08-23)

Same account, unstuck by Phase 16's login-recovery path, immediately hit a second wall: "Request validation failed" at Finish with no indication which field. Root-caused directly against the real backend (`curl`, not inferred from reading code): `POST /branches/:id/room-types` with `sizeM2: 32.55` returns exactly `{"errors":["sizeM2 must be a number conforming to the specified constraints"]}` — `RoomType.sizeM2` is `Decimal(6,1)` (`CreateRoomTypeDto`: `@IsNumber({ maxDecimalPlaces: 1 })`), but `roomTypeSchema` (frontend) never checked decimal precision at all, and `sizeM2`'s field is a plain native number input with no cap — `step="0.1"` only guides the spinner arrows, it doesn't reject a free-typed "32.55". `baseRate` has the same backend limit (`maxDecimalPlaces: 2`) but was already safe: `CurrencyInput` caps it at 2 decimals as-typed (`lib/numberFormat.ts`'s own header comment already documented this), so only `sizeM2` was actually exposed.

### Delivered
- `roomTypeSchema.sizeM2`/`baseRate` both gained a `hasAtMostDecimals` refine, matching the backend's exact limits (1 and 2) — string-based decimal-digit counting off `toString()`, not `value * 10**n` then checking for an integer, since that multiplication can itself introduce the floating-point noise it would be trying to detect.
- `RoomTypeForm`'s Room Size field now rounds to 1 decimal on blur (`Number(Number(v).toFixed(1))`), the same "fix it, don't just flag it" treatment Bed Type's title-case-on-blur already gets — a value that already violates the limit gets corrected the moment focus leaves the field, not just rejected on submit.
- `ReviewStep`'s error display was itself part of the problem: `ApiError.message` alone is the backend's generic `detail` ("Request validation failed"), never showing which field actually failed even though the specific class-validator messages were already sitting unused in `error.errors` (`problem-json.filter.ts`'s `rec.message` array). New `formatApiError()` appends them when present — this is what turned an opaque dead end into something diagnosable at all.

### Verified
`npx tsc --noEmit` and `eslint` clean. The actual failure mode confirmed directly against the running backend (the `curl` call above, not assumed from the DTO alone) before writing the fix. Live Playwright check on the real form: typing `32.55` into Room Size and blurring lands on `32.5`, and Continue advances cleanly past the step afterward.

### Carried forward
- ~~This fix only rounds *new* input going forward...~~ **Closed 2026-08-24**: the gap this warned about was real — a user hit it directly (a stale `sizeM2` from before this shipped kept failing Finish with no visible warning, since `mode: 'onTouched'` never validates an untouched field on its own). `RoomTypeForm` now normalizes every `sizeM2` on mount, not just on blur (`useEffect`, once, against the data the form actually loaded with). `ReviewStep`'s `finishBranch()` also rounds `baseRate`/`sizeM2` right before the request body is built — a second, independent safety net that works even if `RoomTypeForm` is never revisited before Finish. Verified live: a draft mounted with `sizeM2: 32.567` shows `32.6` immediately (no blur needed), and a *separate* Review-only Finish (skipping RoomTypeForm entirely) with an uncorrected `30000.999`/`32.567` room type completes with zero validation errors.
- Everything else already carried forward from Phase 16 — unchanged.

## Phase 18 — Plain email+password login, no subdomain, branch picker (2026-08-23)

Direct user decision: match Cloudbeds' model. Scoped via Plan Mode first — this touches backend auth/schema (`User.email` becomes globally unique; see `roomick-pms-backend`'s own `PHASE_NOTES.md` for that half, including a real architectural constraint the plan surfaced — `users`' FORCE ROW LEVEL SECURITY meant login needed a whole new non-RLS-scoped lookup table, not just a smaller request body).

### Delivered
- **Subdomain removed as a user-facing concept everywhere.** `RegisterForm.tsx` loses the collapsed "Your login id will be X — customize" field entirely (`subdomainExpanded`/`subdomainEdited` state, the live-slugify effect, `lib/slug.ts`'s `slugify()` — now genuinely unused anywhere in this repo, deleted rather than left orphaned). `/login/page.tsx` loses its Subdomain input. `registerSchema`/`loginSchema` (`lib/schemas/auth.ts`) both drop the field. `authStore.login()` drops its third parameter — all 3 call sites (`RegisterForm`, `AutoLoginStep`, `/login`) updated together. `wizardStore.OwnerAccountDraft` needed no direct edit — it's `Omit<RegisterFormValues, 'password'>`, a derived type, so dropping `subdomain` from `registerSchema` cascaded automatically; TypeScript then correctly flagged every remaining `owner.subdomain` read across the app (`ReviewStep`, `page.tsx`'s `CompleteStep`, `resumeOnboarding.ts`, and one the plan's own research missed — `VerifyEmailForm.tsx`'s "Account created for {subdomain}" line, now shows the email instead) as compile errors, which is exactly the point of deriving instead of hand-duplicating the type.
- **`RegisterForm.tsx`'s `SUBDOMAIN_TAKEN` handling removed.** The backend makes it unreachable by any client now (auto-generates and retries internally) — `EMAIL_TAKEN` already fully covers "you already have an account, log in and continue" via the existing resume-offer UI, so there's nothing left for a second conflict branch to do.
- **New `app/login/_components/BranchPicker.tsx`** (Cloudbeds-style property picker) — fetches `GET /auth/me/branches` itself rather than taking a branch-id list as a prop (the JWT's `roles` claim only ever carries ids, never names; this is the one endpoint that resolves them), renders via the existing generic `RadioCard` primitive (same component `OrgStructureForm` already uses for brand-mode selection, not a bespoke list). `/login/page.tsx` renders it only when `getDistinctBranchIds(user.roles).length > 1 && !activeBranchId` (new `lib/branches.ts` helper) — `AutoLoginStep` never reaches this at all, since a freshly registered owner always has exactly one role (`owner`, `branchId: null`), so the picker is only reachable from a returning-staff login at `/login`.
- **`authStore` gains `activeBranchId: string | null` + `setActiveBranchId()`.** Reset on every fresh `login()` and on `clear()` — this store persists to localStorage, so a stale branch id from a previous login would otherwise silently carry into a different one — but deliberately *not* reset by `refreshAccessToken()`, which re-authenticates the *same* session, not a new one.
- **Reload-persistence gap caught and fixed before shipping, not after**: the picked branch's *name* was originally kept only as local component state on `/login`, separate from the persisted `activeBranchId` — a reload would keep the id (correctly suppressing the picker) but lose the name, silently regressing the "Signed in as X — working at {branch}" text back to not naming a branch even though a real pick still stood. Fixed with an effect that re-fetches `/auth/me/branches` and re-resolves the name whenever `activeBranchId` is set but the name isn't — best-effort (a fetch failure there just means the placeholder doesn't name the branch, not a user-facing error). Verified live, deliberately, not assumed: picked a branch, reloaded, confirmed the name was still shown and the picker didn't reappear.
- `activeBranchId` has nowhere real to route to yet — same honest scope boundary `/login`'s own placeholder ("no dashboard/front-desk UI exists past `/signup` yet") already carried before this change; a real property-scoped dashboard is still future work.

### Verified
`npx tsc --noEmit` and `eslint` clean project-wide (only 3 pre-existing `react-hooks/incompatible-library` warnings about RHF's `watch()`, none new). Two required live Playwright scenarios, both against the real backend: a fresh owner signup through the entire wizard (no Subdomain field ever shown, registration → email verification → auto-login all succeed with the new 2-argument `login()`, lands straight on Organization Structure with no picker shown, since a fresh owner has exactly one role); and the real multi-branch staff account created for the backend's own verification, logging in at `/login` — `BranchPicker` shows the two real branch names (not UUIDs), picking one updates the placeholder and sets `activeBranchId` in `roomick-auth` localStorage, and a reload neither re-shows the picker nor loses the branch name.

### Carried forward
- `activeBranchId` still has nowhere real to route to — tracked, not routed, until a real dashboard exists.
- Everything else already carried forward from Phase 17 — unchanged.

## Phase 19 — Extension-caused hydration warning; missing Staff Invite nav item (2026-08-24)

### Delivered
- **`app/layout.tsx` gains `suppressHydrationWarning` on `<html>`.** Not an app bug — a live "hydration mismatch" console error turned out to be a browser extension injecting its own attributes onto `<html>` before React hydrates (`data-qb-installed`, never anything this app renders). Confirmed against this project's own vendored Next.js 16.3.2 docs (`node_modules/next/dist/docs`'s "Preventing Flash" guide) that this is the sanctioned fix for exactly this class of mismatch, not a blanket "hide real bugs" suppression — it only silences *attribute* mismatches on this one element, never children or genuine app-caused ones.
- **`WizardShell`'s sidebar had no way back to Staff Invite.** The step exists (`WizardStep`'s `staff-invite`, mapped to the "Branch Setup" phase in `PHASE_FOR_STEP`) and is fully reachable going *forward* (Continue chains route to it automatically), but the sidebar's branch tree — the only thing rendered under "Branch Setup" — showed branches and "+ Add branch" and nothing else. Navigate away to fix something on an earlier branch, and there was no direct link back; the wizard's own "always reachable once the phase is reached" navigation convention silently didn't extend to this one step. Fixed with a `{ kind: 'staff-invite' }` addition to `BranchTreeFocus` (tenant-wide, not per-branch — a sibling row below every branch, not nested under one) and a new "Staff Invite" `TreeRow` rendered after "+ Add branch".

### Verified
`npx tsc --noEmit` and `eslint` clean. Live Playwright check: the new nav item is visible once Branch Setup is reached, and clicking it correctly routes to the Staff Invite step. Separately root-caused, not fixed in code (nothing to fix): a "Could not load roles" error on that same step turned out to be `roomick-landing`'s dev server having claimed port 3000 after the real backend lost it in a `nest start --watch` restart race (confirmed via `netstat`/process inspection, not guessed) — every `/api/v1/*` call was silently hitting Next's own 404 page instead of the NestJS backend. Cleared the orphaned process tree and restarted the backend cleanly; `GET /auth/roles` confirmed working again with a real token.

### Carried forward
- Everything else already carried forward from Phase 18 — unchanged.

## Phase 20 — Room Status Board, the first real dashboard screen (2026-08-25)

### Delivered
- **`app/dashboard/`** — `layout.tsx` (auth gate + branch resolution + shared shell), `page.tsx` (filters/selection composer), `_components/{RoomStatusFilters,RoomGrid,RoomCell,RoomDetailPanel,BranchPicker}.tsx`. Reference page 19's layout: a "Building(s)" card (building → floor → room chips) on the left, a detail panel on the right; filter row above both.
- **Real, load-bearing bug fixed as part of this, not incidental**: `activeBranchId` (set by the branch picker) never got populated for a single-branch owner — the only kind of account onboarding could produce. An owner's own role is always `branchId: null` ("all branches"), so the picker correctly never showed for them, but nothing else ever set `activeBranchId` either — there was no code path that gave a signed-in owner a concrete branch to open a dashboard with. `app/dashboard/layout.tsx` fixes this with a `useEffect` that auto-selects when exactly one branch resolves, and only falls back to rendering `BranchPicker` when there's genuinely more than one.
- **First real use of React Query in this app** — installed since Phase 1, genuinely unused until now. `lib/rooms.ts`: `useRoomsQuery` + `useChangeRoomStatusMutation` (invalidate-and-refetch on success, not an optimistic update — simple and correct for a front-desk shift's status-change cadence).
- `lib/groupRoomsByFloor.ts`, `lib/roles.ts` (`isSupervisorAtBranch` — UX-only gating; the backend's own `changeStatus` is the real authority), `lib/useRequireAuth.ts` (generalizes the auth-gate pattern for every future authenticated route), `lib/dashboardBranches.ts` (`useMyBranches` — routes to `GET /auth/me/branches` or the new owner-only `GET /branches` depending on whether the account has an explicit branch-scoped role).
- **`app/login/page.tsx` simplified** to just the credentials form + a redirect on success/already-authenticated. It used to own branch resolution and render a "Signed in as X... dashboard is the next phase" placeholder (plus an inline `BranchPicker`) — both moved to `/dashboard/layout.tsx`, which is the more honest owner of "which branch am I working in" now that `/dashboard` is real. `BranchPicker.tsx` moved from `app/login/_components/` to `app/dashboard/_components/` and became presentational (`branches` passed as a prop instead of self-fetching — both `/login` and the picker used to independently call the same endpoint).
- `RoomCell` reuses `StatusTag.tsx`'s exported `STATUS_STYLES` map for its fill color (not the whole pill-shaped badge, which is sized for inline prose, not a dense grid) — a status's color can't drift between the grid chip and the detail panel's badge. `RoomDetailPanel`'s housekeeping-ladder buttons mirror the backend's `CLEANLINESS_TRANSITIONS` map client-side (same accepted UX-only drift risk `lib/roles.ts` already documents) purely to decide which buttons to show; the backend's own ladder check is what actually enforces it.

### Decisions & deviations
1. **The reference's "Occupied By" guest card is left out entirely**, not faked with placeholder data — it needs the reservations/billing modules, and those have zero backend modules registered yet (`app.module.ts` only wires Auth/Tenants/Users/Property). `RoomDetailPanel` shows only what this backend slice actually has: number, floor, room type, view, notes, composite status, and the status-change actions.
2. **Filters use this app's own `Select`** (an underline-field listbox), not the reference's separate popover-badge treatment — `Select` already shows its current value inline, so a second "Filters (1)" summary chip next to it would be redundant.

### Verified
`npx tsc --noEmit`, `eslint`, and `npm run build` all clean. Live, against the real backend — not mocked: seeded a fresh tenant directly via the real API (2 branches, 2 buildings, 24 rooms across 6 floors, a housekeeper with an explicit branch role) and ran a full Playwright pass — multi-branch owner correctly sees `BranchPicker` (not stuck/blank) and reaches a populated grid on pick; all 5 composite status colors render correctly (confirmed against actual seeded occupancy/cleanliness/held combinations, not just glanced at); clicking a room opens the correct detail panel; the full housekeeping ladder (dirty→cleaning→clean→inspected) clicked through live as owner, each step confirmed against the real re-fetched status; an occupancy correction and a hold/release both round-tripped correctly; reload after picking a branch stays on that branch, no re-prompt; logout redirects to `/login`; a signed-out direct visit to `/dashboard` redirects to `/login`; logged in separately as the seeded housekeeper — confirmed the Occupancy Correction and Hold sections and the supervisor-only "Mark Inspected" button are all correctly hidden, *and* separately confirmed the backend still 403s a direct, out-of-band `PATCH` call for occupancy correction (not just trusting the hidden button); all three filters (Room Status, Building, Room Category) and Clear All exercised live and confirmed against exact expected room counts.

One real bug caught and fixed during this verification pass, not by inspection: `RoomStatusFilters`' three `Select` instances had no `id`/`name` prop, so they all defaulted to the same `id="select"` — clicking a `<label>` only ever opened the *first* select on the page regardless of which label was clicked. Fixed by giving each filter an explicit, unique `id`.

### Carried forward
- Everything else already carried forward from Phase 19 — unchanged.
- `RoomStatusFilters`, `RoomGrid`, etc. don't yet handle a floor with zero rooms (backend's own accepted gap, noted in its `PHASE_NOTES.md`) — not reachable through this app's current onboarding flows, so untested here too.
- Tax builder — deferred until the backend/DB supports it (explicit user instruction, not yet scheduled).

## Phase 21 — Front Desk hub, correcting Phase 20's shell (2026-08-25)

Phase 20 shipped Room Status Board directly at `/dashboard` with no sidebar at all — reference page 10 (the actual Front Desk hub, already rendered to this repo's scratch history but never opened before building) was skipped over in favor of page 19 alone. Caught live, not in review.

### Delivered
- **`/dashboard` is now the Front Desk hub** (Roomick-UI.pdf page 10) — three sections (Check-In, Check-Out, In-House Management), each a row of `HubCard`s (icon, title, description, optional real stats). Room Status Board moved to `/dashboard/room-status-board`, reached via its card. Only that one card is a real `Link` with real stats (vacant/occupied/cleaning/held counts, sharing its React Query cache with the board page's own `useRoomsQuery` — no extra fetch). Every other card (Arrivals Dashboard, Check-In Flow, Walk-In Booking, Departures Dashboard, Check-Out Flow, Room Change, In-House Guest List) has zero backend behind it — rendered inert (no `href`, `opacity-70`, `title="Not built yet"`) rather than omitted (misrepresenting the documented architecture) or linked nowhere.
- **`Sidebar.tsx`** (new, shared via `layout.tsx`) — Front Desk / Check-In / Check-Out / In-House Management / Reservations / Housekeeping / Billing and Payments / Folio Transfer / Point of Sale / Shift Management / No-Show Handling / Guest Registration Card / Comms Log, matching the reference exactly. Same inert-vs-real split as the hub cards. "In-House Management" only expands to show its two children (matching `WizardShell.tsx`'s own "only the active section auto-expands" rule) while `/dashboard/room-status-board` is actually open — collapsed everywhere else, including the hub itself, which is what both reference pages (10 and 19) actually show.
- **Breadcrumb color fix**: non-current crumbs ("Operations"-equivalent, branch name, "Front Desk" when not on the hub) were `text-secondary-light` — sampled the reference directly (pymupdf pixel sampling, not eyeballing) and confirmed that role is `text-primary-text`, the same token `Section.tsx`'s own labels already use. Fixed; the current/active crumb stays bold `text-secondary`.
- **`font-display` (Playfair Display) added to every page-level H1** built this segment (`Front Desk`, `Room Status Board`, `Log in to Roomick`, `Choose a property`) — all four were plain `font-body` (Satoshi), confirmed wrong against the reference (every page title in Roomick-UI.pdf renders serif). `design-system/02-typography.md` calls this pairing "opt-in… for a small set of future brand moments (an auth screen, an empty state)" — page titles across Front Desk and the login/branch-picker screens are exactly that set; the doc's own examples just hadn't been implemented consistently yet. `font-display` was already correctly applied to the "Roomick" wordmark itself (`WizardShell.tsx`, `layout.tsx`) — only the page H1s were missed.
- **`RoomStatusFilters` alignment fix**: the filter row used `items-end`, so when one `Select`'s dropdown opened (growing that flex item taller), bottom-alignment shoved every *closed* sibling field down with it. Switched to `items-start`; the "Clear all" button (which has no label above it, unlike the `Select`s) gets an invisible label-sized spacer instead of a hand-tuned margin, so it lines up with their input row without a magic number that could drift out of sync with `Select`'s own spacing.

### Verified
`npx tsc --noEmit`, `eslint`, `npm run build` all clean. Live Playwright pass against the real backend: logging in and picking a branch lands on the Front Desk hub (not the board); the hub's H1 and the board's H1 both compute to `Playfair Display` via `getComputedStyle`; the sidebar renders every reference row; clicking the Room Status Board card navigates to and past the correct route; the breadcrumb shows the full `Front Desk / Room Status Board` chain once there; the Room Status filter's bounding box is pixel-identical before and after opening Room Category's dropdown (confirms the alignment fix, not just visual impression). One more real bug caught by the same pass: the sidebar's "Front Desk" label was rendering as `FRONT DESK` — copied the hub section labels' `uppercase` class onto it by mistake; the reference shows it in normal case. Fixed and re-verified.

### Carried forward
- Everything else already carried forward from Phase 20 — unchanged.

## Phase 22 — Mirror the backend's BRANCH_NAME_TAKEN code (2026-08-25)

Backend half in `roomick-pms-backend/PHASE_NOTES.md` — `createBranch` now rejects a same-name collision under the same brand (409), root-caused from a real duplicate branch found live in a signed-in account's own data.

### Delivered
- `lib/api.ts`'s `ApiErrorCode` union gains `'BRANCH_NAME_TAKEN'`, keeping the hand-maintained mirror in sync (no shared-types package between the two repos yet — same accepted drift risk this file's own header comment already documents).

### Decisions & deviations
1. **No dedicated catch branch in `ReviewStep.tsx`'s `handleFinish`.** Checked `formatApiError()` first rather than assuming a special case was needed: it already returns `error.message` directly, which for this code is the backend's own `A branch named "X" already exists under this brand` — already clear and actionable through the existing generic `ApiError` branch. Adding a second code path that does the same thing would be pure duplication.

### Verified
`npx tsc --noEmit` clean. Backend half verified live (real 409 on a name collision, real 201 on a genuinely new name) — no frontend-specific behavior to separately verify beyond the type addition compiling.

### Carried forward
- Everything else already carried forward from Phase 21 — unchanged.

## Phase 23 — Front Desk hub's section containers were hand-rolled instead of reusing Section (2026-08-25)

Caught live: the hub's three section wrappers (Check-In/Check-Out/In-House Management) used a hand-rolled `border-accent/30` box with no fill. Pixel-sampled the reference precisely (pymupdf, high-DPI crop) rather than eyeballing again after the last round of color misses — the outer box border is `#cc9f00` (this app's own `primary`) over a pale warm-cream fill, i.e. exactly `Section.tsx`'s existing default (`tone="primary"`, `bg-primary-light/15 border-primary/40`), which already implements "small-caps gold label + rule above a pale gold box" — the exact shape `HubSection` had just re-implemented by hand.

Also re-sampled the individual cards' own title/description text at high DPI to check whether they needed the same "primary" treatment: title `#160028` and description `#a697b2` matched this app's `--color-secondary` / `--color-secondary-light` almost exactly (off by one channel value — anti-aliasing noise, not a real difference). Those were already correct; only the outer container was wrong.

### Delivered
- `app/dashboard/page.tsx`'s hand-rolled `HubSection` replaced with the real `Section` component (default `tone="primary"`) — deleted, not kept as a thin wrapper.
- `HubCard.tsx`'s own fill/border now imports and reuses `CARD_TONE_CLASSES.secondary` from `Card.tsx` instead of a hand-copied near-match (`bg-secondary/5` vs. the real token's `bg-secondary/10`) — same "reuse the constant, don't hand-copy it" discipline `Card.tsx`'s own header comment already documents.

### Verified
`npx tsc --noEmit`, `npm run build` clean. Live screenshot compared directly against the reference crop — outer containers now show the correct gold border/pale-gold fill, inner cards unchanged (confirmed already correct).

### Carried forward
- Everything else already carried forward from Phase 22 — unchanged.

## Phase 24 — Reservations: 5 new pages, making the Front Desk nav real (2026-08-25/26)

Backend half in `roomick-pms-backend/PHASE_NOTES.md` — same reduced scope (flat rate, no Folios/Payments, no ID capture). This phase wires the Front Desk hub's Check-In/Check-Out/In-House Management cards and sidebar rows to real pages instead of inert placeholders.

### Delivered
- **5 new routes**: `app/dashboard/arrivals`, `departures`, `in-house-guest-list`, `walk-in-booking`, and the dynamic `check-in/[reservationId]`. `HubCard`s and `Sidebar.tsx` rows for all of them switched from inert to real `href`s; "Room Change" and everything under Operations stays inert (genuinely nothing built behind them).
- **Walk-In Booking is dual-mode**, one route, not two — this is the load-bearing piece: if walk-in (create + immediate check-in) were the *only* way to create a reservation, nothing would ever sit in `confirmed` waiting on Arrivals, and the dedicated Check-In Flow page would have nothing to show and no way to be exercised through the UI at all. Mode is derived from the picked check-in date (today = immediate, shows a room picker, submits to the walk-in endpoint; any future date = book-ahead, room-type inventory only, submits to plain reservation create) — not a separate toggle.
- **Check-In Flow** (`check-in/[reservationId]`) reuses `RoomGrid`/`RoomCell`/`groupRoomsByFloor` exactly as `room-status-board/page.tsx` already composes them, filtered client-side to vacant + not-held + clean-or-inspected rooms of the reservation's own room type — no new backend endpoint needed for the room list, same `useRoomsQuery(branchId)` call/cache Room Status Board already uses.
- **Check-out has no dedicated page** — a `ConfirmDialog` (already built, reused) from the Departures row is the entire check-out UX, its copy stating plainly that it doesn't settle any charges ("billing isn't available yet"), matching `HubCard`'s own `title="Not built yet"` honesty convention rather than silently pretending a balance was handled.
- New `lib/reservations.ts` (React Query hooks, same shape as `lib/rooms.ts`), `lib/guests.ts` (types only — no dedicated guest-search hook yet, every reservation-create DTO takes inline guest fields), `lib/schemas/reservations.ts` (Zod, mirrors the backend DTOs field-for-field), and `components/ui/Table.tsx` (new, generic — the app had no table primitive before three pages needed one at once).
- `Sidebar.tsx` rewritten around a `GROUPS` config (label, children, `activeWhen`) instead of one hardcoded boolean + a single one-off JSX block — the same shape now drives all three groups (Check-In/Check-Out/In-House Management) uniformly. `layout.tsx`'s breadcrumb replaced a two-way ternary (hardcoded to exactly `/dashboard` vs. Room Status Board) with a route→title map, since it would have silently mislabeled every route added this phase.

### Decisions & deviations
1. **A collapsed sidebar group's own label is a real link to its first child** — caught live, not in review: a first pass left every collapsed group fully inert, which meant a group you weren't already inside of was a dead end reachable only by going back through the hub card first (e.g. Arrivals → Room Status Board had no direct path). Fixed by making the group label itself navigate to its first real child, expanding it once you land there — closes real cross-section navigation without the hub detour.
2. **`GET /reservations/:id` added beyond the original endpoint sketch.** The Check-In Flow page navigates to a fresh route and needs its own fetch — it can't reuse Arrivals' in-memory React Query cache across a route boundary.

### Verified
`npx tsc --noEmit`, `eslint`, `npm run build` all clean. Live Playwright, real backend: book-ahead booking via Walk-In Booking hides the room picker and does not affect Room Status Board; direct cross-group sidebar navigation (Arrivals → In-House Management's collapsed link → Room Status Board) works with no hub detour; immediate-mode Walk-In Booking's room picker shows real ready rooms, confirming increases the occupied count on Room Status Board by exactly one; In-House Guest List shows the new guest; the dedicated Check-In Flow page independently verified end-to-end too (seeded a `confirmed`, no-room reservation directly via API, found it on Arrivals, opened Check-In Flow, confirmed guest details and room picker render correctly, checked in, confirmed the reservation disappears from Arrivals after the post-mutation refetch). One real test-flakiness source chased down and fixed in the verification script itself (not the app): clicking "Confirm Check-In" immediately after selecting a room could race React's state update before the button's `disabled` attribute cleared — waiting for the button to actually become enabled before clicking it made the same flow pass reliably; the backend's own state was correct in every run regardless, confirming this was a test-timing artifact, not a product bug.

### Carried forward
- Everything else already carried forward from Phase 23 — unchanged.
- Arrivals/Departures have no date picker this pass — always "today" (branch timezone). A real reservation booked for a future date is correctly invisible on today's Arrivals until that date arrives; not tested further beyond confirming that's the actual (accepted) behavior.
- Reservations has no general search/management screen — the sidebar's own "Reservations" row stays inert.

## Phase 25 — Reference audit + shared page/table chrome (2026-08-27)

A full audit of every built screen against `Roomick-UI.pdf` (rendering each reference page and screenshotting the live app side by side) found the IA, colors, and typography on track, but surfaced **systemic drift**: each list page had hand-rolled its own header and table, and every one of them had independently ended up missing the same reference chrome. Fixed as shared components rather than page-by-page, specifically so the pattern stops repeating — the Guest Folio page (ref p33) would have been the fourth.

### Audit result
- **On track**: route/IA mapping matches the reference page-for-page (hub=p10, Arrivals=p11, Check-In=p12/13, Walk-In=p14, Departures=p15, In-House=p18, Room Status Board=p19); sidebar groups match; backend model matches the DB architecture doc; build order being followed.
- **Drift found and fixed** (below).
- **Correctly deferred, confirmed still-blocked**: ID Capture (needs the encryption pass), rate-plan/Payment sections (need Rate Resolver), Folio columns (need P4), Room Change / Reservations calendar / Housekeeping (whole modules unbuilt).

### Delivered
- **`components/ui/PageHeader.tsx`** (new) — icon + serif `text-title` H1 + subtitle + closing rule, the header shape every reference operations page uses. Every dashboard page now uses it; none re-implement it. This is what all 7 pages had independently gotten wrong (no icon, no rule).
- **`components/ui/Table.tsx` extended** — sortable headers with the reference's paired ↑↓ arrows (`sortValue` per column; columns without it stay unsorted, matching which columns the reference marks sortable), "← N/N →" pagination, and a real CSV Export button (RFC 4180 quoting, so a guest name with a comma doesn't split columns). Sorting/paging are client-side over already-fetched rows — each list is one branch's data in a single request, so server-side paging would be API surface with nothing to gain yet.
- **`components/ui/SearchInput.tsx`** (new) — the reference's magnifier + underline search field, reusing `Input.tsx`'s exported underline/placeholder constants rather than a hand-copied near-match.
- **New page-header icons** in `Icons.tsx` (plane-landing, plane-takeoff, clipboard-list, building-arrow, walk-in, receipt) plus table chrome (search, sort, arrows, download).
- Arrivals/Departures/In-House all now have the header icon+rule, search, sortable columns, pagination, Export, and a Status column.
- **Component-discipline fix**: `check-in/[reservationId]` was using ad-hoc `<h2 className="text-body font-bold">` where every other page uses the `Section` component's gold small-caps label; Walk-In Booking mixed both. Both now use `Section` throughout (Guest Details as `tone="accent"`, matching `ReviewStep`'s read-only-detail convention, with its `Row` label corrected to `text-accent-dark` to match).
- **Layout fix**: Walk-In Booking was single-column where the reference pairs fields two-up — it rendered roughly twice as tall as intended. Now a 2-col grid, matching p14.

### Decisions & deviations
1. **No "Room" column on Arrivals**, though the reference has one. In this design a room is only assigned *at* check-in (spec §4.3), so the column would be a wall of dashes. The reference's Arrivals showing "203 · Vacant" implies room pre-assignment at booking — a real divergence, deliberately kept as-is for now (decision: follow the spec) and recorded here rather than silently ignored. Revisit when the Reservations module (ref p20–26) is built.
2. **"Group", VIP badge, and Folio Balance columns omitted** — all need `GuestProfile`/`Folio` fields this pass deliberately excludes. Named in each page's own header comment so it's clear they're deferred, not overlooked.
3. **Filter rows not added to the list pages.** Room Status Board's existing filter row already established the pattern (plain `Select`s, Phase 20); adding filters to Arrivals/Departures/In-House needs real filterable fields (Guest Status, Reservation Type) that don't exist yet. Search covers the actual current need.

### Verified
`npx tsc --noEmit`, `eslint` (0 errors; only the 4 known pre-existing RHF `incompatible-library` warnings), `npm run build` all clean. Live screenshots of all 7 pages re-captured and compared against their reference pages — header icon/rule, search, sort arrows, Status column, and Export all render correctly; Walk-In Booking's two-column layout confirmed roughly halving the form height.

### Carried forward
- Everything else already carried forward from Phase 24 — unchanged.
- Pagination only appears above one page of rows (by design) — not yet exercised against a >10-row list.

## Phase 26 — Guest Folio: billing pages, City Ledger, live balances (2026-08-27)

Backend half in `roomick-pms-backend/PHASE_NOTES.md`, including the two design corrections (check-out never blocks on a balance; room charges accrue one night at a time) that came from studying the in-house PMS and Cloudbeds rather than assuming.

### Delivered
- **`/dashboard/billing`** — folio list with **Outstanding / Overdue / All** tabs (server-filtered, so the definitions live in one place) and the reference's **Guest Status** column rendering `City Ledger` / `Still In-House`. Built on the Phase 25 `PageHeader` + `SearchInput` + sortable `Table` — exactly the payoff that refactor was for; this page needed no new chrome.
- **`/dashboard/billing/[folioId]`** — Guest Folio (ref p33), all five sections: Guest Details (`tone="accent"`), Line Items with the "+11.25 tax" per-line suffix and a right-rail totals card, Tax Breakdown (per rule, with taxable base), Add Charge, Payment. Plus a **Close Folio** action disabled above a zero balance, and a City Ledger banner when the guest has departed owing.
- **Projected stay total** shown above Balance Due, read off `reservation.confirmedRate` — Cloudbeds' "pending vs posted" intent (front desk sees the full expected bill, not just what's accrued) without needing a pending flag on `LineItem`. Deliberately labelled distinctly so it can't be mistaken for what's owed.
- **`lib/folios.ts`** (types + React Query hooks, mutations invalidating folio/list/in-house keys), **`lib/schemas/folios.ts`** (Zod mirrors), and `formatMoney` added to `lib/numberFormat.ts` — with an explicit comment that its `Number()` is **display-only**, since the backend is the sole authority on money arithmetic.
- **In-House Guest List** finally gains the reference's **Folio Balance** column and **View Folio** action — the two columns the Phase 25 audit flagged as blocked on this module. Balances come from one branch-folio request keyed by reservation, not N per-row fetches.
- **Departures** now shows a Balance column, and its check-out dialog **warns instead of misleading**: it names the outstanding amount and states that checking out anyway is allowed and turns the balance into a City Ledger receivable. The old "billing isn't available yet" copy is gone.
- **`Sidebar.tsx`**: "Billing and Payments" is a real group (Guest Folio live; Split Billing / Night Audit / Refunds and Corrections inert). The group-rendering JSX was extracted into a `GroupRow` component so the Front Desk groups and this one share one implementation rather than a copy.

### Decisions & deviations
1. **No per-charge tax-rule picker**, though ref p33 shows one. `TaxRule.appliesToChargeTypes` already declares which charge types a rule taxes, so the engine resolves them from the charge type. Hand-picking per charge would let the two disagree and produce tax rows that don't match the branch's own rules.
2. **One charge at a time**, not the reference's repeatable "Charge 1 / Charge 2 / + Add charge" block. Each post is its own transaction with its own taxes, so batching would be a UI convenience over the same N calls.
3. **Print / Send Email buttons omitted** — the comms module is stubbed (`communication_log` rows only), so they'd do nothing.

### Verified
`npx tsc --noEmit`, `eslint`, `npm run build` clean. Live Playwright against real folio data, 17/17: sidebar reaches the list; tabs and the seeded guest render; all five folio sections render; the room charge shows **one night (150.00), not the 300.00 full stay** — the accrual model visible in the UI; the VAT row and per-rule breakdown render; posting a charge from the UI appears in the ledger; "Pay full balance" then Save Payment drives the balance to 0.00; In-House Guest List shows the Folio Balance column and View Folio action. Zero console errors. One test-only bug found and fixed along the way (`Section` renders labels uppercase via CSS, which `innerText` reflects — the assertions were case-sensitive; the app was correct throughout).

### Carried forward
- Everything else already carried forward from Phase 25 — unchanged.
- Night audit, Cloudbeds-style Transfer-to-AR, Split Billing, Refunds and Corrections, Folio Transfer, POS — all still inert/deferred and named in both repos' notes.

## Phase 27 — Night Audit page (2026-08-27)

Backend half in `roomick-pms-backend/PHASE_NOTES.md` — the accrual rollover, no-show marking, the check-out safety net, and a timezone-aware hourly sweep.

### Delivered
- **`/dashboard/night-audit`** (ref p35) — Pre-Audit Info (checklist + open folios), Unresolved No-Shows with per-row "View Reservation", and the Trigger Audit action behind a `ConfirmDialog` that spells out what a run does and that it can't be undone. Open-folio rows link straight to `/dashboard/billing/[folioId]`.
- **`lib/nightAudit.ts`** — preflight/history queries and the run mutation, which invalidates folios, in-house and arrivals alongside its own keys, since a run posts charges and can flip reservations to no-show.
- Wired into the Billing and Payments sidebar group and `ROUTE_TITLES`; the group now expands for both `/dashboard/billing` and `/dashboard/night-audit`.

### Decisions & deviations
1. **Untracked checks render as "Not tracked", never as a tick.** Two of the reference's three pre-audit conditions need the maintenance and shift modules, which don't exist — `passed: null` comes back from the API and the row renders neutral. A green check there would be a lie about a condition nobody verified.
2. **"Recent Runs" is an addition to the reference.** The spec's own health rule (a run stuck in `running` over 10 minutes) is unobservable without somewhere to see run history, and `night_audit_log` exists precisely to record it.
3. The trigger disables itself when the pending date has already been audited, and says so — the backend still enforces it with `409 AUDIT_ALREADY_RAN` regardless.

### Verified
`npx tsc --noEmit`, `eslint`, `npm run build` clean. Live Playwright, 12/12: reachable via the Billing sidebar group; all three sections render; the checklist shows the real failing departures check alongside two "Not tracked" rows; the page states which date it would close (or that it already ran); the runs table shows Manual/Scheduled origin and amounts with the currency symbol; breadcrumb correct; zero console errors.

### Carried forward
- Everything else already carried forward from Phase 26 — unchanged.
- Split Billing, Refunds and Corrections, Folio Transfer, POS, Housekeeping, Reservations calendar — still inert and named.

## Phase 28 — Split Billing, standalone flow pages, and the color-family correction (2026-08-27)

Three things, all prompted by looking at the running app rather than the code.

### Delivered
- **`/dashboard/split-billing`** (ref p34) — pick a reservation's source folio, pick a target folio on the same reservation, tick the charges to move, see a live preview of both balances after, give a reason, split. Backend half in `roomick-pms-backend/PHASE_NOTES.md`.
- **`/dashboard/check-in`** and **`/dashboard/check-out`** — the Check-In and Check-Out Flows are now real pages with a guest dropdown, not aliases for the Arrivals/Departures dashboards. Check-In lists today's arrivals and hands off to `/dashboard/check-in/[reservationId]`; Check-Out lists **everyone in-house**, not just today's departures, because an early check-out is a real front-desk event that a date-scoped dashboard can't serve. Check-Out shows the live folio balance and links into the folio to settle — never blocks.
- **`Sidebar.tsx` rewritten.** Every child now owns a distinct href and its own `isActive` predicate.

### The two bugs this fixes
1. **Double-active nav.** "Arrivals Dashboard" and "Check-In Flow" both pointed at `/dashboard/arrivals`, so a plain `pathname === href` comparison lit up both — two tabs looking selected at once, with no way to tell which one you were on. The real fix wasn't the comparison, it was that two nav entries shared a destination; giving the flows their own pages removed the ambiguity at the source.
2. **Compressed sidebar rows.** Flex children shrink by default, so once the list outgrew the viewport the rows squashed into each other instead of the column scrolling. Every row is `shrink-0` now, and there's a live assertion that no boxed row drops below 30px.

### The color-family correction
Page-background text was using `secondary`/`secondary-light` (violet near-black and lavender-gray). It should be the **primary** family. Pixel-sampling Roomick-UI.pdf p33 settles it: `#291E00` title, `#242000` subtitle, `#2D2300` sidebar — all `primary-dark` (`#2E2400`), none of them anywhere near `secondary` (`#160029`).

`secondary`/`secondary-light` is for text **inside a `tone="secondary"` card**. Swept `PageHeader`, the shell breadcrumb/header, every loading and empty state, and every `Section` interior (tables, helper text, rules) to the primary family, while leaving secondary-card interiors — the folio totals rail, the night-audit checklist and open-folios cards, the data tables inside `Card tone="secondary"` — untouched.

**The rule is now written down** in `design-system/01-color.md` § "Which family on which surface", with a per-surface table and the practical test (walk up to the nearest ancestor with a background; if it isn't `CARD_TONE_CLASSES.secondary`, the text is primary). It had to be corrected twice by hand before being documented, which is the reason it's documented.

### Decisions & deviations
1. **Form-field labels are the one exception** and keep `text-secondary` regardless of surface. `Input`/`Select`/`Textarea` appear inside every tone, so a single label color is the only way they stay consistent — and `#160029` vs `#2E2400` is imperceptible at label size. Recorded in the color doc as a call, not an oversight.
2. **Check-Out Flow lists all in-house guests, not today's departures.** Deliberate divergence from Departures, and what makes it a distinct destination rather than a second route onto the same list.
3. **Inert sidebar rows stay visible.** Same reasoning as `HubCard`'s inert variant — omitting them would misrepresent the documented architecture.

### Verified
`npx tsc --noEmit` clean; `eslint` 0 errors (4 pre-existing React-Compiler/RHF `watch()` warnings). Live Playwright, 26/26: **exactly one active nav row on each of all ten routes**; no compressed sidebar row (min 31px over 12); page title computes to `#2e2400` and renders in Playfair; the sidebar computes to `#2e2400`; Check-In Flow's dropdown selects a guest, shows their details, and its continue button navigates into `/dashboard/check-in/<uuid>`; Check-Out Flow's dropdown shows a real balance (`₦96.75`) with the currency **symbol**, not a code; Split Billing renders its Folio Selection section and source-folio picker. Zero console errors.

One assertion of mine was wrong before the code was: the first row-height check flagged a 14px row as "compressed". That was the unpadded "Front Desk" header link doing exactly what it should — the assertion was measuring the wrong set of elements, not finding a bug.

### Carried forward
- Refunds and Corrections, Folio Transfer between reservations, Cloudbeds-style Transfer-to-AR, POS, Housekeeping, Room Change, Reservations calendar, Comms Log — still inert and named in both repos.

## Phase 29 — Root redirect, header icon color, hub-card icons and press states, the Front Desk box (2026-08-28)

A run of direct feedback on the running app, each item small on its own.

### Delivered
- **`/` now redirects to `/dashboard`** (307, deliberately not 308 — `/` is exactly the route most likely to become something else later, and a permanent redirect would cache that choice hard). The old `app/page.tsx` scaffold — "Real application pages haven't been built yet" — is deleted; it was the style guide's only entry point, which now lives unlinked at `/style-guide` for anyone who knows the URL.
- **Page-header icons now match their title's color** (`primary-dark`, not the gold `primary-text`) — an icon is part of the title lockup, not a separate accent.
- **Every Front Desk hub card has its reference icon** — three were missing entirely (Departures, Check-In/Check-Out Flow) and one was wrong: the old "Departures" icon was a bare take-off plane, but the reference (both the p10 card and the p15 header) draws a city skyline WITH the plane, pairing it with the buildings the guest is leaving. Check-In/Check-Out Flow share one hotel-with-stars icon, differing only in which side the door-arrow points — matching how the reference draws that exact pair.
- **Hub cards deepen by one 10% tint step on hover, another on press** (`/10` rest → `/20` hover → `/30` active) — the same increment the card-nesting mechanic already uses, so a hovered card reads as "one level closer" rather than a new highlight color. Replaced a `hover:brightness-95` filter that dimmed the text and border along with the background, which is why hover used to look greyed-out instead of raised.
- **Sidebar child pills now carry a real border + fill at rest that both strengthen when selected** (border ~35%→70% white, fill ~20%→50% `primary-light` over the group's gold), bolding only the selected pill — all three pixel-sampled off the reference (p11), not guessed. An unselected pill previously had no border at all.
- **The Front Desk box.** The reference wraps "Front Desk" + Check-In/Check-Out/In-House Management in one bordered section that closes before Reservations, Housekeeping, Billing and Payments, etc. begin as their own separate top-level rows — missing entirely from an earlier pass that flattened all four groups into one list with no shared wrapper. The box's border color is pixel-solved (its stroke over its fill lands on `primary` at ~30% alpha — the same `border-primary/30` a collapsed group row already used) and has no fill of its own (the reference's box interior and the page around it are close enough to be the same surface). Its children are indented one step relative to "Front Desk" — the reference itself draws them flush, but was told directly to make the hierarchy visually clearer, which the mockups' own stated purpose (convey feel, not literal pixel law) makes a legitimate call rather than a deviation to flag twice.

### Decisions & deviations
1. **Root redirect chains through the dashboard's own auth gate rather than duplicating it.** An unauthenticated visitor takes two hops (`/` → `/dashboard` → `/login`) instead of one — keeps auth decided in exactly one place.
2. **A `SidebarGroup` can now declare its own `href`** (only Reservations does, added the same phase it needed one) so its label becomes a link back to a real overview page, collapsed or expanded — Billing and Payments has no such page, so its collapsed click still falls back to its first real child.

### Verified
`npx tsc --noEmit` clean; `eslint` 0 errors. Live Playwright: root redirects to `/login` logged out and to the Front Desk hub logged in; `/style-guide` still serves; page icon computes to the same `#2e2400` as its title; 18/18 on hub-card icons + tint steps (rest/hover/press alpha measured directly at 0.1/0.2/0.3, an inert card confirmed NOT to react); 6/6 on sidebar pill border/fill/weight measurements; 21/21 on the Front Desk box (wraps exactly its three groups, everything else stays outside, indented, still expands correctly on its own child pages). Two of my own mistakes caught and fixed mid-phase: a `{/* comment */}` placed inside a ternary's JSX slot broke parsing and 500'd every page with a header (which briefly looked like a broken auth gate, until the actual parse error surfaced); and a row-height regression test flagged a legitimately-smaller 27px child pill as "compressed" — its floor was calibrated for a different row type, not a real bug.

### Carried forward
- Everything from Phase 28's own list — unchanged.

## Phase 30 — Reservations module: search, availability calendar, create/modify/cancel/waitlist (2026-08-28)

Backend half in `roomick-pms-backend/PHASE_NOTES.md`. The reference's own sequence is Front Desk → Reservations → Housekeeping → Billing and Payments; Billing shipped in Phase 26, so this is Reservations — the sidebar row (and hub page) that's been inert since Phase 24 first flagged it.

### Delivered
- **`/dashboard/reservations`** — the hub (ref p20), mirroring the Front Desk hub's own pattern: six cards, five real with live stats (confirmed/waitlisted/recently-cancelled counts), one inert.
- **`/dashboard/reservations/availability-calendar`** (ref p21) — year/month pickers, a room-type-by-date grid of available counts, color-coded (green/amber/red) the same three-way read as the reference's own occupancy row.
- **`/dashboard/reservations/create`** (ref p22) — guest, room type, dates, party size, special requests. On a genuinely full room type, offers **"Join the Waitlist Instead"** — the explicit path the new `joinWaitlist` flag exists for, not an automatic fallback.
- **`/dashboard/reservations/modify`** (ref p23) — search a confirmed/waitlisted reservation, edit dates/room type/party size, a live new-total preview, a mandatory reason.
- **`/dashboard/reservations/cancel`** (ref p24) — search, review, optional reason, confirm.
- **`/dashboard/reservations/waitlist`** — every waitlisted reservation, each with a "Promote" action that re-checks availability live and confirms it if a room has opened up; if not, it says so and the row stays put.
- **`Sidebar.tsx`**: "Reservations" is now a real expandable group with its own hub link (see Phase 29's `SidebarGroup.href` addition) — five real children, Rate Plan Management stays inert.
- **Five new icons** (`CalendarIcon`, `CreateReservationIcon`, `ModifyReservationIcon`, `CancelReservationIcon`, `WaitlistIcon`), matching the reference's own hub-card icon for each.

### Decisions & deviations
The reference's Create/Modify/Cancel screens are each a full page of machinery this pass doesn't build — the backend notes list the reasons in full (no rate-plan resolver, individual-only bookings, pre-check-in-only modification, no cancellation-policy/penalty calculation, per-room-type rather than per-room availability). On the frontend specifically:
1. **Create Reservation isn't extracted into a shared component with Walk-In Booking**, even though both call the same `createReservation` mutation with the same flat-rate pricing. They only look similar today — Walk-In Booking's dual immediate/future toggle and room picker don't belong on a Reservations-module page, and this page's waitlist path doesn't belong on Walk-In Booking's. Two genuinely different pages sharing a backend call, left as two pages.
2. **Modify and Cancel fetch confirmed + waitlisted reservations separately and merge client-side**, rather than adding a "status in [...]" query param the general search endpoint doesn't support for a two-value set — a small, honest trade-off for not extending the backend DTO for a shape only these two pages need.

### Verified
`npx tsc --noEmit` clean; `eslint` 0 errors (5 warnings, the same pre-existing React-Compiler/RHF `watch()` class as four other pages already had — Modify Reservation's own `watch()` usage is the fifth). Live Playwright against real data, 25/25: sidebar "Reservations" is a real link opening the hub; all six hub cards render, Rate Plan Management confirmed inert; the sidebar group expands correctly on a child page with the active pill marked; the availability calendar renders a real multi-cell grid; Create Reservation books a real advance reservation and navigates to Arrivals; Modify Reservation finds a reservation, edits it, and saves; Cancel Reservation cancels a real reservation end to end; Waitlist Management renders. A second run specifically exhausted every unit of a real room type via direct API calls (not a mock) and confirmed the full loop live: Create Reservation genuinely fails with `RESERVATION_NOT_AVAILABLE`, offers the waitlist path, joining it creates a real `waitlisted` reservation, and promoting it while still full correctly fails and leaves it waitlisted.

One real bug found and fixed live, not by inspection: Modify Reservation's form-reset `useEffect` depended on the `selected` reservation object rather than its `id`. A successful save invalidates the confirmed/waitlisted queries, which refetches and hands back a **new object** for the same reservation — the effect re-ran on that new reference, wiping the just-shown "Changes saved." message and the reason field a moment after they appeared. Fixed by keying the effect on `selectedId` (a stable primitive) instead.

### Carried forward
- Rate Plan Management, group/multi-room bookings, ID capture, payment/deposit at booking, cancellation policy + penalty/refund, per-room Gantt-view availability, Modify for an already-checked-in stay — all named in the backend notes, all deferred.
- Housekeeping (ref p27-31) is next in the reference's own sequence and hasn't been started.
- Everything else already carried forward from Phase 29 — unchanged.

## Phase 31 — Housekeeping module, hub-card grid/color corrections, react-icons migration (2026-08-28)

Backend half in `roomick-pms-backend/PHASE_NOTES.md`. Housekeeping (ref p27-31) is next in the reference's own sequence after Reservations — the last of the three sections the sidebar had listed inert since Phase 24. Also folds in three rounds of direct visual feedback on the running app, and a full icon-library migration requested mid-session.

### Delivered
- **`/dashboard/housekeeping`** — the hub (ref p27): four cards, **all real** (unlike Reservations' one inert Rate Plan card, everything here maps onto schema/service surface that already existed or landed alongside this phase).
- **`/dashboard/housekeeping/task-board`** (ref p28) — "Dirty Rooms" (pending, unclaimed-or-mine) with Start Cleaning / Report Issue, "In Progress" (mine) with Complete / Report Issue. Report Issue opens a modal (area + description) and marks the task `skipped`, appending the note — no image upload (needs encrypted file storage that doesn't exist).
- **`/dashboard/housekeeping/staff-assignment`** (ref p29) — idle/busy housekeeper counts, and unassigned dirty rooms with a per-row housekeeper picker that calls the new `assignTask` endpoint.
- **`/dashboard/housekeeping/inspection-workflow`** (ref p30) — Approve / Mark Dirty on every room awaiting inspection, calling `RoomsService.changeStatus` directly (no new backend needed at all — that transition already existed from the Room Status Board phase).
- **`/dashboard/housekeeping/room-blocking`** (ref p31) — block a room (room/reason/date-range/notes form) and see every active block, with an End Block action that pulls `toDate` back to today rather than deleting the record.
- **`Sidebar.tsx`**: "Housekeeping" is now a real expandable group with its own hub link, same pattern Reservations established.
- **A real breadcrumb bug, found live the moment a third top-level section existed to expose it**: the header breadcrumb hardcoded "Front Desk" as its middle segment unconditionally, so visiting Housekeeping showed "Roomick / Lagos Flagship / **Front Desk** / Housekeeping" — factually wrong, implying Housekeeping is a child of Front Desk. `layout.tsx` now derives the correct section (Front Desk / Reservations / Housekeeping / Billing and Payments) from the route via a small prefix table, the same general mechanism that already existed for page titles.

### Three rounds of direct visual feedback, each a real bug
1. **Hub cards were `flex-wrap`, not a grid.** A `flex-1` lone third/fifth card (Walk-In Booking, Room Change) stretched to fill its row instead of sitting in its own cell — the reference always keeps a clean fixed grid with trailing cells left empty. Every hub's card container is now `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`, and `HubCard` itself dropped the `flex-1 min-w-64` that caused the stretch.
2. **Hub card description text was the wrong color entirely.** Pixel-sampling the reference (ref p10) showed the description's peak ink color is the exact same near-black as the bold title above it (`secondary`, `#160029`) — it only *reads* lighter because it's a normal font weight over a thinner stroke, not because it's a different, lighter token. `text-secondary-light` was swapped for full `text-secondary`. The stats line underneath, by contrast, pixel-sampled to an exact match for `secondary-light` (`#A698B2`) — a genuinely different, lighter color, left unchanged.
3. **Subsection labels (`Section`'s own "CHECK-IN"/"IN-HOUSE MANAGEMENT" header next to the divider) used the wrong token, twice.** First correction: full-strength `primary-text` was too saturated — the reference's label reads as the same gold pulled back with opacity. Second, direct correction after I still had it wrong: it's `primary-dark` at 50% opacity, not `primary-text` at 50% — the dark bronze variant pulled back, not the small-accent gold variant. Fixed to `text-primary-dark/50`, the one place this label color is defined for the whole app.
4. **The active Front Desk sidebar section had no background at all.** Every other selected-group affordance in the sidebar has some fill; the outer Front Desk box (added in Phase 29) was border-only even while active. Now carries `bg-primary/10` — the same 10%-at-rest convention `CARD_TONE_CLASSES` already used at the time — conditional on the current route being anywhere under Front Desk's own umbrella (the hub itself, or one of its three groups' children).

### react-icons migration
All ~30 hand-drawn inline SVGs in `Icons.tsx` replaced with `react-icons` (Feather for generic UI chrome — chevrons, search, arrows; Font Awesome where an exact semantic match exists — a landing/departing plane, a receipt, a "ban" glyph for Room Blocking/OOO), on direct instruction. Every export name and the `{ className }` contract stayed identical, so **zero call sites changed** across the ~15 pages that import icons — this was a pure internal-implementation swap in one file. One genuine improvement fell out of it: Task Board previously borrowed `ModifyReservationIcon` (a clipboard+pencil) because the hand-drawn set had no dedicated glyph free; now that a full library is available, it has its own `TaskBoardIcon` (`FaTasks`), and the two call sites that borrowed the old one were updated.

`design-system/05-imagery-motion.md`'s Iconography section — which flatly stated "no icon library dependency" as a deliberate stance — is updated to describe the current approach and name it as a direct instruction superseding the original one, not a silent reversal.

### Decisions & deviations
1. **No dedicated `MaintenanceIssue` table for Report Issue.** The existing `HousekeepingTask.notes` field plus its `skipped` status already cover "this room needs something other than a normal clean" at this scope.
2. **Report Issue does not create a `RoomBlock`.** Whether an issue is serious enough to pull a room from inventory is a supervisor's own judgment call in Room Blocking/OOO after reading the report, not an automatic consequence of filing one.
3. **A card's own rest-state tint is `Card.tsx`'s own concern, not touched by this phase's hover/press work.** `HubCard`'s hover/press states are fixed absolute values (10%/15%, rebalanced downward alongside `Card.tsx`'s own rest-state tint dropping from 10%/15% to 5% for `secondary`/`primary`), independent of whatever `CARD_TONE_CLASSES.secondary`'s rest-state alpha happens to be at any given time.

### Verified
`npx tsc --noEmit` clean; `eslint` 0 errors (5 pre-existing React-Compiler/RHF `watch()` warnings, same class as before). Live Playwright, 19/19 on Housekeeping: sidebar group real and expandable with its own hub link; all four hub cards render; a **real checkout** (via the actual `walk-in` → `check-out` API path, not a manually-created task) auto-creates a visible Task Board entry; Start Cleaning, Complete, and Approve each verified against **ground-truth room data re-fetched from the API** (`dirty` → `cleaning` → `clean` → `inspected`), not just UI text; a new room block appears and can be ended. Separately, 6/6 on the grid/color fixes (lone cards no longer stretch, description color matches the title's, section-label opacity applied) and 25/25 re-run clean on the full Reservations suite (icons still resolve, nothing regressed from the migration). All existing suites (nav/flows, hub-card tints, sidebar box, front-desk background) re-run and still pass.

### Carried forward
- Image uploads for Report Issue, a dedicated maintenance-issue table, Rate Plan Management, group/multi-room bookings, ID capture, payment/deposit at booking, cancellation policy + penalty/refund, per-room Gantt-view availability, Modify for an already-checked-in stay — all still deferred and named.
- Folio Transfer, Point of Sale, Shift Management, No-Show Handling, Guest Registration Card, Comms Log — the last of the sidebar's inert rows, still unbuilt.

## Phase 32 — Sidebar sections unified, card-tint convention propagated to 5% (2026-08-28)

Direct feedback, comparing the running app against the reference's own sidebar (p20's "Reservations" box, p27's "Housekeeping" box) side by side.

### The bug
Front Desk was structurally special-cased — its own hardcoded box in `Sidebar()`'s JSX, ALWAYS rendered fully expanded (Check-In/Check-Out/In-House Management always visible) no matter which section you were actually in. Reservations, Housekeeping, and Billing and Payments went through a completely different component (`GroupRow`'s "expanded" state), which rendered a **solid gold** box with every child pill living on that gold — not the bordered, pale box Front Desk had. Two real, visible problems: Front Desk never collapsed away when you navigated elsewhere (permanently eating vertical space), and Reservations/Housekeeping/Billing's own boxes didn't match the reference's own look for those exact sections (p27's Housekeeping box is pale and bordered, with only the ONE active page — "Room Blocking / OOO" — solid gold; the sibling pages sit as plain bordered pills, not on a shared gold background).

### The fix
One shared `TopLevelSectionRow` component for all four sections (Front Desk, Reservations, Housekeeping, Billing and Payments) — collapses to a single bordered row when nothing inside it is open, expands to a `border-primary/30 bg-primary/5` box (its own label + indented children) when it is. Front Desk keeps its unique second level of nesting (Check-In/Check-Out/In-House Management, each still its own `GroupRow` with the pre-existing solid-gold behavior — that part of the reference genuinely is different, a sub-group with its own children, not a direct page) — nothing else in the sidebar has that extra depth. Reservations/Housekeeping/Billing's own direct children are now `LeafPill`s: plain bordered pill at rest, solid `bg-primary` fill only when that exact page is the one open, sitting straight on the section's own pale background rather than a second gold layer.

Billing and Payments — the one section with no dedicated hub page — now has a real `href` (`/dashboard/billing`, its own first and most useful page) used identically to the other three sections' real hubs, rather than a special "no href, fall back to first child" case that only it needed.

### Propagated: the card-tint convention's move to 5%
You'd manually edited `Card.tsx`'s `CARD_TONE_CLASSES` (`secondary`/`primary` both 10%/15% → 5%) and `HubCard.tsx`'s hover/press steps (20%/30% → 10%/15%) directly while this was in progress. Swept every place that value was hand-copied or documented at the old rate: `FeatureCard.tsx` had hand-copied `bg-secondary/10` independently rather than importing `CARD_TONE_CLASSES` — now imports it directly, so it can't drift out of sync again the way it just had. The style guide's own live nesting demo (`ColorSection.tsx`) visually reflects the change automatically (it already imported `CARD_TONE_CLASSES`), but its percentage LABELS and formula display (`1 − 0.9^N`) were hardcoded separately and had gone stale — corrected, with a comment flagging that this one number has to be kept in sync by hand if the rate ever moves again. `01-color.md`'s whole "card-nesting mechanic" section (the compounding-math table, both `secondary`/`accent` and `primary` subsections), `cards.md`, and `layout-patterns.md` (`Section`'s own box, `FeatureCard`'s tint) all corrected to the current 5%/5%/10% (secondary/primary/accent) rates, with the reasoning framed honestly as "this rate has moved twice, by direct call, not measurement" rather than restating the old "15% is the minimum" claim as if it still held. `layout-patterns.md`'s "not the same as a solid nav panel, not-yet-built" note was also stale — the nav panel it was describing (`Sidebar.tsx`'s `GroupRow`) has existed for phases now; corrected to point at it directly instead of describing it as future work.

### Verified
`npx tsc --noEmit` clean; `eslint` 0 errors. Live Playwright, 18/18: Front Desk box exists and Reservations stays a single collapsed link while on the Front Desk hub; navigating to Housekeeping's Room Blocking page collapses Front Desk to a single link and expands Housekeeping into its own box containing all four of its pages as plain pills; exactly one active leaf pill, solid `bg-primary`; the inactive sibling pill is NOT gold; the box background measures the 5% convention directly; Reservations still shows its own 6 items correctly; Billing and Payments (no dedicated hub) expands the same way, Guest Folio marked active inside it. Every existing suite (nav/flows: 23/23, hub-card tints: 18/18, front-desk background: 3/3, the full Reservations phase: 25/25, the full Housekeeping phase: 19/19) re-run clean after updating a handful of scratch-test selectors that targeted the old `bg-primary`-solid box structure (an expected, not a regression — the box's own classes genuinely changed) and two scratch-test percentage assertions still checking for the pre-rebalance 10%/20%/30% values.

### Carried forward
- Everything from Phase 31's own list — unchanged.

## Phase 33 — Rate Resolver: live rate quoting, Rate Plan Management (2026-08-28)

The backend replaced flat `baseRate × nights` with a real cascade/override pricing engine (see `roomick-pms-backend/PHASE_NOTES.md`'s own entry) — this wires the frontend up to it. Two pages had priced a stay with nothing shown on screen at all until now: Create Reservation and Walk-In Booking never displayed a rate, cost, or total anywhere before this phase.

### `RatePreview` — shared, not duplicated
One component (`app/dashboard/_components/RatePreview.tsx`), used by both Create Reservation and Walk-In Booking — the two pages that create a `Reservation` and therefore both need the identical live-quote behavior the reference names explicitly for its own `RatePreview` component: "calls endpoint on mount, re-fetches on prop change, never caches locally." `useCalculateRateQuery` (`lib/rate-resolver.ts`) sets `staleTime: 0` for exactly that reason — the backend endpoint also writes a `RateAuditLog` row on every call, so a stale client-held quote isn't just wrong, it's untracked. React Query's own dependency-keyed re-fetching handles the "don't spam it on every keystroke" concern for free — a date `<input type="date">` commits atomically, it isn't typed character by character the way a text field is.

Renders nights × avg rate, the winning rule's name (or "Standard Rate"), subtotal, tax (only when nonzero), and total — confirmed live against a real Weekend cascade plan (`115.00/night avg` off a `90` base + `25` fixed uplift, `230.00` subtotal, `247.25` with tax, all matching the API's own numbers exactly).

**No promo-code or corporate-account input on either form yet** — the backend already accepts both (`CreateReservationDto`/`WalkInReservationDto` gained `promoCode`/`corporateAccountId`), but building the picker UI for them is deferred, not silently dropped. `RatePreview` itself already accepts both props, so wiring a picker in later is additive, not a rework.

**Currency symbol is blank on these two pages specifically** — every other money display in the app resolves currency from data it was already fetching for other reasons (a folio, a reservation with `branch.currency` included); a brand-new booking form has no such reservation yet, and the branch-detail endpoint that would supply it (`GET /branches`) is Owner-only, not reachable by the `front_desk` role that actually uses these forms. `formatMoney` already renders correctly with no symbol (grouped, 2dp) — chose not to build a new endpoint as a side quest of this phase.

### Rate Plan Management — the sidebar's last inert Reservations row
`/dashboard/reservations/rate-plans`: a create form (type/room-type/name/amount, an adjustment-type picker that hides itself for negotiated/promotional since their amount is absolute, not a delta — mirroring the backend's own validation for a better error experience, not just duplicating it) plus a sortable table with a Retire/Reactivate toggle (never a hard delete, matching `TaxRule`'s own convention). `cascadeTier` is never shown or made editable — the backend derives it from `type` alone, there's nothing here for it to set. Wired the sidebar's `Rate Plan Management` leaf, the Reservations hub's card (now shows a live active-plan count, matching every other hub card's stats convention), and `layout.tsx`'s breadcrumb title — the same 3-spot wiring every previously-inert row in this app has needed.

Found and fixed a real accessibility gap while building this page's form: every `Input` here needed an explicit `name` prop for its `<label htmlFor>` to actually associate with the field (`Input.tsx`'s `fieldId = id ?? name` — omit both and the label has no `for`, same failure Playwright's own `getByLabel` hit first). Fixed for every field on this new page; pre-existing plain-`useState` forms elsewhere (e.g. Room Blocking) have the same gap but were out of this phase's scope to touch.

Added `RatePlanIcon` (`FaTags`) to the react-icons wrapper set — no existing icon fit "a list of pricing tiers."

### Verified
`npx tsc --noEmit` clean, `eslint` 0 errors (same pre-existing React-Compiler/RHF `watch()` warning class as before, one new instance from Create Reservation's own new `watch()` calls), `npm run build` clean (`/dashboard/reservations/rate-plans` registered as a static route).

Live Playwright end to end: created a Weekend cascade plan through the actual UI → `RatePreview` on Create Reservation resolved it live with the exact right numbers → submitted the booking → confirmed `confirmedRate` via the API (ground truth) → confirmed a promotional override (posted directly, no UI picker yet) replaces the rate outright rather than stacking with the cascade → retired the plan through the UI's Retire button → confirmed a fresh quote for the same dates fell back to the plain base rate. This same run also surfaced the two real backend bugs named in the backend's own PHASE_NOTES entry (a BigInt-serialization crash and an orphaned audit trail) — caught here because this was the first time anything actually exercised the audit endpoint with real rows, not by backend inspection alone.

### Carried forward
- Everything from Phase 32's own list — unchanged.
- Promo-code / corporate-account picker UI on Create Reservation and Walk-In Booking.
- A branch-currency source reachable by non-Owner roles, so `RatePreview` (and any other pre-reservation money display) can show a real currency symbol.
- Carrying a promo/negotiated override forward across Modify Reservation (currently re-resolves through base/cascade tiers only — see the backend's own PHASE_NOTES entry).

## Phase 34 — No-Show Handling, and a sidebar structure correction found while placing it (2026-08-28)

The backend's `ReservationsService` gained `markNoShow`/`waiveNoShowPenalty`/`reinstateFromNoShow`/`listPendingNoShows` (see its own PHASE_NOTES entry — it also unifies this with Night Audit's pre-existing automated sweep and closes a real gap where a computed penalty was never actually posted as a folio charge). This phase is the frontend for it: `/dashboard/no-shows` — a Pending No-Shows list with a one-click "Mark as No-Show" (behind a `ConfirmDialog`, since it's a real financial/status action), and a Recent No-Shows list showing each penalty with Waive and Reinstate actions. Reinstate opens a `Modal` for the revised dates a late arrival needs (the original check-in date has necessarily already passed) plus an optional "also waive the penalty" checkbox.

### Where it actually belongs — checked the reference, not assumed
Before wiring the sidebar, checked `Roomick-UI.pdf` p9 directly rather than guessing a placement: its own sidebar nests No-Show Handling — along with Folio Transfer, Point of Sale, Shift Management, Guest Registration Card, and Comms Log — under **Billing and Payments**, not as a standalone top-level item. Roomick's own sidebar had all six of those living as a SEPARATE flat list (`INERT_TOP_LEVEL`) rendered below the real top-level sections — a structural mismatch from the reference that predates this phase, just never mattered until one of the six needed a real page. Fixed properly rather than adding a seventh special case: all six moved into `BILLING_SECTION.items` (the five still-unbuilt ones as inert leaves — already a supported, existing pattern, see `Refunds and Corrections` — the No-Show Handling leaf now real), and `INERT_TOP_LEVEL` together with its own render block removed entirely now that it's empty. `layout.tsx`'s `sectionFor()` breadcrumb helper and `ROUTE_TITLES` both gained the new route.

### A real accessibility gap, found building this page's own Reinstate form
Reused `Input`/`Modal` for the reinstate date fields and hit `getByLabel` failing to find them in Playwright — traced to `Input.tsx`'s `fieldId = id ?? name`: without either prop, `<label htmlFor>` has nothing to point at, so the label is visually present but not actually associated with the field for assistive tech either. Not a testing-only issue — a real a11y gap. Fixed by giving every `Input` on this page an explicit `name`. Other plain-`useState` forms elsewhere in the app (e.g. Room Blocking) have the same latent gap; out of scope to sweep in this phase, since none of them happened to need `getByLabel` to notice it yet — worth a dedicated pass later.

`ReservationSummary` (`lib/reservations.ts`) gained `noShowRecords` (mirrors the backend's own `RESERVATION_INCLUDE` addition — latest mark only) so the Recent No-Shows list can show penalty state without a second round-trip. Added `NoShowIcon` (`FaUserSlash`) to the react-icons wrapper set.

### Verified
`npx tsc --noEmit` clean, `eslint` 0 errors (same 6 pre-existing React-Compiler/RHF `watch()` warnings — none new, this page uses plain `useState`), `npm run build` clean (`/dashboard/no-shows` registered as a static route).

Live Playwright, 16/16: created a real confirmed reservation via the API → appeared in Pending No-Shows → marked as a no-show through the actual UI (confirm dialog and all) → confirmed via the API that the reservation flipped status, a `NoShowRecord` was created with the right penalty, and the folio's `guestStatus` was `"city_ledger"` (the backend's own fix, confirmed end-to-end through this UI, not just at the API layer) → Recent No-Shows showed the penalty → waived it through the UI → confirmed the folio auto-settled to zero → reinstated through the Modal with new dates → confirmed the reservation was `confirmed` again with a freshly re-resolved rate. Two real backend bugs (the City Ledger gap above, and the nested-transaction risk in `reinstateFromNoShow`'s waive path) were caught while building THIS page's own verification flow, not found by backend inspection alone — the same pattern as Phase 33's audit-trail bugs.

### Carried forward
- Everything from Phase 33's own list — unchanged.
- The other five reference items now correctly nested under Billing and Payments (Folio Transfer, Point of Sale, Shift Management, Guest Registration Card, Comms Log) are still inert — this phase only moved and correctly placed them, it didn't build them.
- The pre-existing `Input.tsx` label-association gap on other plain-`useState` forms (Room Blocking named specifically) — real, not urgent, not swept here.

## Phase 35 — Guest Registration Card: signature pad, auto-redirect from check-in (2026-08-28)

The backend now auto-generates a `RegistrationCard` inside `checkIn`/`walkIn`'s own transaction (see its own PHASE_NOTES entry — DB-only by explicit choice, no PDF/S3 infrastructure exists in this project, so the guest snapshot and signature live directly in Postgres). This phase is the frontend: a hand-rolled canvas `SignaturePad`, the `[cardId]` view/sign page, a hub page for the branch's own card template and looking up an existing card, and — the biggest UX piece — Check-In Flow and Walk-In Booking (immediate mode) now redirect straight to the freshly generated card instead of back to a list, so the front-desk agent has the guest sign it right there as part of the same interaction, matching the reference's own framing of this as one continuous check-in step, not a separate errand.

### `SignaturePad` — Pointer Events, not three separate handlers
One code path (`onPointerDown`/`onPointerMove`/`onPointerUp`) covers mouse, touch, AND stylus — exactly what the reference's "touch/mouse/stylus" calls for, without hand-rolling separate mouse and touch listeners the way an older browser API would have forced. Uncontrolled by design: the canvas owns its drawing state internally, and the parent reads it out via `ref.current.getDataUrl()` only at the moment the Sign button is actually clicked — a controlled version re-rendering (and losing the in-progress stroke) on every parent state change would be a real bug, not just wasted work.

### The redirect chain
Both Check-In Flow and Walk-In Booking's immediate mode now do: complete the check-in mutation → fetch `GET /reservations/:id/registration-card` (the card the backend just auto-generated in the same transaction) → `router.push` to it, falling back to the old destination (Arrivals / Room Status Board) only if no card comes back (shouldn't happen given the backend guarantee, but a network hiccup on that one extra fetch shouldn't strand the agent on a blank state).

### `window.print()` as the closest thing to a document, made to actually look clean
Added `print:hidden` to the sidebar `<aside>` and the dashboard `<header>` — a print/print-to-PDF of the card page without this would include the nav chrome and breadcrumb, not just the card itself.

### A real `react-hooks/set-state-in-effect` catch on the template form
First draft synced the branch's saved template into local `useState` fields via a `useEffect` — flagged by lint as cascading-render-prone (multiple `setState` calls firing synchronously inside one effect). Fixed by extracting a `TemplateForm` child component that only ever mounts once `templateQuery.data` is already loaded (the parent gates it behind the same loading check already on screen), so each field's `useState` reads its initial value directly from a prop — no sync effect needed at all, and the lint error is structurally impossible rather than suppressed.

### Verified
`npx tsc --noEmit` clean, `eslint` 0 errors (same 6 pre-existing React-Compiler/RHF `watch()` warnings — none new), `npm run build` clean (`/dashboard/registration-cards` and `/dashboard/registration-cards/[cardId]` both registered).

Live Playwright, 17/17: saved a branch house-rules template through the actual UI, confirmed it persisted via the API → walked a guest in through the real Walk-In Booking form (picking a room type with genuinely available inventory in this shared dev DB, not blindly the first option) → check-in auto-redirected straight to a freshly generated card with no intermediate step → confirmed the snapshot showed the right guest/room/dates AND the saved house rules, with no ID-document fields anywhere in it → signed it with a real mouse-drawn stroke on the canvas → confirmed `signedAt`/`witnessedBy`/a genuine non-trivial base64 PNG all landed via the API → confirmed the backend rejects a second sign attempt with `409` → reloaded and confirmed the page correctly shows a view-only signed state (no pad, a Print button) rather than re-offering the form.

### Carried forward
- Everything from Phase 34's own list — unchanged.
- Real PDF generation / encrypted storage, ID capture and its required encryption, and `requiredFields` template configuration — all explicitly deferred, named in the backend's own PHASE_NOTES entry.

## Phase 36 — Overbooking Management: exposure heatmap, config form, walk-a-reservation (2026-08-28)

No reference mockup exists for this page at all (checked directly against `Roomick-UI.pdf` before building — confirmed empty, not assumed) — the reference's Month 4 prose ("thresholds, a walk flow, an exposure dashboard") is the only spec, so structure and placement were both original calls, documented inline rather than left implicit.

### Structure
One page, three sections, top to bottom: a **config form** (per room type or branch-wide, `globalEnabled`/`maxOverbookPct`/`alertAtPct`/validity window) via a `ConfigForm` child component reading its initial state straight from the selected room type's existing config (same "child component owns its own `useState` seeded from a prop, no effect" shape `registration-cards/page.tsx`'s own `TemplateForm` established last phase — deliberately reused rather than re-solving the same `set-state-in-effect` risk a different way); an **exposure heatmap** (year/month pickers, a table of room types × nights, red-highlighting any night where `isOverbooked`) styled to visually match the existing Availability Calendar page rather than invent a second heatmap convention; and a **walk a reservation** form (reservation picker scoped to `confirmed` bookings, relocation property + optional transport/compensation fields, calls the walk endpoint and shows the refund outcome inline).

### Sidebar placement
Added as a leaf under the existing Reservations section rather than its own top-level group — it's a control panel over the same availability engine Availability Calendar and Waitlist Management already live under, not a separate domain. Left an explicit comment in `Sidebar.tsx` noting the absence of a reference mockup, so a future pass correcting this against a real design doesn't have to rediscover that context from scratch.

### Verified
Live Playwright against real Postgres (`verify-overbooking.js`), 10/11 checks: found a room type's exact physical capacity via the API, booked it to exactly that count through the real reservation endpoint, confirmed the next booking hard-blocks with `409` — overbooking OFF → opened this page through the actual sidebar link, selected the room type, enabled overbooking at 50% via the real `YesNoToggle`/inputs, saved, confirmed both the UI's own confirmation text and the API's persisted values → the identical overflow booking now succeeds with `201` → switched to the exposure heatmap, picked the matching year/month, confirmed the room type's row renders and the specific overbooked night is flagged `isOverbooked: true` both in the API response and visually (red-highlighted cell, screenshotted) → used the walk form to walk the overbooked guest to a named relocation property, confirmed the UI's own success message. The one failure (a second run's "booked exactly the physical pool" check returning `409` instead of `201`) was the first run's own leftover test reservations occupying part of the same future date window on this shared dev DB — not a product bug; the underlying capacity-gate behavior had already passed cleanly on the first run.

### Carried forward
- Everything from the backend's own Overbooking Management PHASE_NOTES entry — unchanged.
- No reference mockup exists for this page — if one surfaces later, this page's layout should be reconciled against it rather than assumed correct forever.

## Phase 37 — Shift Management: cash drawer open/close, handover, carried-over issues (2026-08-28)

Per the MVP timeline reference (Month 5) — this one had a genuinely detailed frontend-structure spec (full component list and request/response shapes, not just prose), so the page follows it closely rather than inventing layout the way Overbooking Management had to.

### One page, state-driven rather than tabbed
The whole page is one of two states: no open shift → the Open Shift form (plus, right above it, the previous shift's handover notes and any still-unresolved issues, so an incoming agent sees them before doing anything else) — or an open shift → a live Current Shift summary (type, opened-at, opening float, cash taken so far), this shift's own issue log with an inline add-issue form, and the Close Shift form directly beneath it. Shift History sits at the bottom in both states, a plain table (agent, type, open/close times, a color-coded variance badge, unresolved-issue count) — same "no page needs the generic sortable `Table` component's full machinery" call Overbooking Management's own exposure heatmap already made.

### The denomination counter is currency-agnostic by construction
The reference's own mockup shows a fixed-row table (one row per note/coin value). Built as a dynamic add/remove list instead — branches run in different currencies (`Branch.currency`), so hardcoding NGN's own denominations would silently break for any other one. Shared between the open-float count and the closing-cash count rather than two near-identical components.

### Resolve vs. Carry Over, surfaced everywhere an issue can appear
`IssueRow` is one shared component used in three places — the handover banner (last shift's carried-forward issues), the current shift's own issue list, and (implicitly, via history) nowhere else since past shifts are read-only. Both actions are always offered; the backend's own `@Roles(Owner, Manager)` gate on `PATCH /shift-issues/:id` is trusted as-is rather than duplicating a role check in the UI, matching this project's established page-level-RBAC-is-enough precedent — a front-desk agent who tries anyway just gets the API's own `403` surfaced inline.

### Verified
Live Playwright against real Postgres (`verify-shifts.js`), 21/21 real checks (one script assertion — a lowercase string match against text a CSS `capitalize` class visually renders as "Morning"/"Evening" — was the test's own bug, confirmed by screenshot, not a product issue): opened a shift through the actual UI → recorded a cash payment via the API and confirmed it auto-attached to that shift while a card payment on the same folio did not → logged an issue through the UI and saw it render → closed the shift through the UI with the exact expected cash total and confirmed zero variance plus the handover note persisted → verified via the API that an unexplained over-threshold variance is rejected but succeeds once explained, with a bundled hand-off issue landing in the handover view → carried that issue over (no resolution timestamp) then resolved it (stamped) → reloaded and confirmed Shift History renders both closed shifts with correct agent, times, color-coded variance, and issue counts, screenshotted at each step.

### Carried forward
- Everything from the backend's own Shift Management PHASE_NOTES entry — unchanged.
- Card-total reconciliation, the "issue age (shifts outstanding)" counter and its 3+ auto-highlight, and shift-scoped POS/outlet session linkage — all deferred, named there.
- "Export shift report PDF" and "Expand row: full shift report" (reference: Shift History) — no PDF generation exists anywhere in this project yet (same gap named against Registration Cards); the history table's own columns already carry everything the expanded-row mockup lists, just not as a separate expand interaction.

## Phase 38 — Guest Communications Log: reservation-scoped timeline, manual send (2026-08-28)

Per the MVP timeline reference (Month 5) — its own route is guest-profile-scoped (`/guests/:guestId/comms`), but this app has no Guest Profile hub page for a tab to hang off of yet.

### Reservation-centric, not guest-profile-centric — a deliberate substitution, matching an existing precedent
Rather than block this feature on building a Guest Profile page first (a bigger, separate piece of scope), the page is its own hub: search a reservation by confirmation number or guest name (reusing the exact same `useReservationsQuery` search the app already has elsewhere), select it, see its full timeline, send a one-off message. This is the same shape of trade-off Guest Registration Card made last phase for the identical "the reference assumes a page that doesn't exist here" situation. `GET /guests/:guestId/communications` is fully built and tested on the backend with nothing pointed at it in the UI yet — ready the moment a Guest Profile page exists to host it.

### Timeline entries read the delivery-status badge honestly
Every row shows `queued` right now — not because the UI is wrong, but because the backend's own schema comment says the sending adapter is stubbed for MVP. `DELIVERY_TONE` still maps all six real `DeliveryStatus` values (including `sent`/`delivered`/`opened`/`failed`/`bounced`) so the page needs no changes the day real sending lands and those statuses start actually appearing.

### Verified
Live Playwright against real Postgres (`verify-comms-log.js`), 13/13: created a reservation via the API and confirmed `booking_confirmation` auto-logged → cancelled it with a reason and confirmed the cancellation entry's body names that exact reason → opened the page through the actual sidebar link, searched by the guest's name, and confirmed both entries render with correct labels and status badges → expanded a message and saw its full body → sent a manual message through the real composer, confirmed the UI's own "Logged." confirmation and the new entry appearing in the timeline, then confirmed via the API it's stamped with the real logged-in agent as `sentBy` → confirmed the (UI-less) guest-level endpoint returns the identical set of entries, screenshotted throughout.

### Carried forward
- Everything from the backend's own Guest Communications Log PHASE_NOTES entry — unchanged.
- A Guest Profile hub page, and wiring this page's guest-level query onto it once it exists.
- Real sending, delivery-status transitions past `queued`, and "Resend failed message" — all deferred on the backend side, named there.

## Phase 39 — Operational Reports: Occupancy, ADR, RevPAR, Revenue (2026-08-28)

Per the MVP timeline reference (Month 5) — the last Month 5 item, and with it the last item in the reference's own Month 1–5 MVP deliverable list. "Reports & Analytics" is a real top-level sidebar section here (matching ref p9's own placement — a peer to Front Desk/Reservations/Housekeeping/Billing, not nested under Billing), with two inert leaves (Financial Reports, Custom Report Builder) alongside the one real page, following this project's established convention for reference items confirmed out of MVP scope.

### No charting library — CSS bars, matching this app's own established restraint
No page anywhere in this project has installed a chart library, despite several earlier reference mockups asking for one (Overbooking's own exposure heatmap is a plain coloured-cell table, not a chart). `TrendBars` renders the trend line as a row of scaled `<div>`s instead — legible, zero new dependency, consistent with the app's whole visual vocabulary so far. Installing a real charting library is a deliberate future call, not something to slip in unnoticed as a side effect of one report page.

### One page, four tabs, sharing date-range/room-type controls
Occupancy / ADR / RevPAR / Revenue sit behind the same tab-switcher pattern Guest Folio's own Outstanding/Overdue tabs already established, rather than four separate routes — they share the exact same date-range and room-type filter controls, and a caller comparing two of them shouldn't have to re-enter the same range twice.

### CSV export is real; PDF is not
Each breakdown table has a working "Export CSV" button — a client-side Blob download, no backend endpoint needed, since the data's already in hand. PDF export is NOT built: no PDF generation exists anywhere in this project (the same gap already named against Registration Cards and Shift Reports), and the reference's own "Export CSV / PDF button" tooltip treats them as one interchangeable feature when they're really two very different amounts of work.

### Verified
Live Playwright against real Postgres (`verify-reports.js`), 10/14 literal checks passed — the 4 that didn't are confirmed test-script issues, not product bugs, verified by screenshot: two assumed an isolated dataset ("exactly 1 room-night sold today") that this session's own long-lived shared dev DB no longer satisfies after many earlier phases' test reservations (the *relational* assertions in the same checks — available-equals-physical-pool, revpar-divides-by-available-not-sold — passed cleanly); two were case-sensitive text matches against section labels a CSS `uppercase` class visually renders differently, the same class of false-failure "Morning"/"Evening" produced for Shift Management last phase. The actual UI: opened the page through the real new "Reports and Analytics" sidebar section, walked through all four tabs, and confirmed KPI cards, the trend chart, and breakdown tables all render real, correct figures — screenshotted at each tab.

### Carried forward
- Everything from the backend's own Operational Reports PHASE_NOTES entry — unchanged, including its full list of what's explicitly out of MVP scope (Custom Report Builder, scheduled reports, Financial Reports' own charts, cross-property/HQ reporting, PDF export).
- Arrivals/Departures and Outstanding Balances are intentionally not duplicated here — they already have their own dashboards from earlier phases.

## Phase 40 — Production Readiness (Month 6): mobile-responsive dashboard shell (2026-08-28)

Per the MVP timeline reference (Month 6) — "Mobile-responsive views for front desk and housekeeping confirmed." Checked live rather than assumed: a Playwright pass at a 375px viewport (iPhone-class width) across six representative pages first measured zero horizontal-scroll overflow on every one — which looked like a pass, until the actual screenshots showed the real problem a scroll-width metric can't see at all: the header's breadcrumb trail and the sidebar's own fixed `w-60` rail were both squeezing every page's real content into roughly a third of the screen, with the breadcrumb text visibly overlapping the Log Out button. No page needed its own fix — this is one shared shell (`app/dashboard/layout.tsx` + `Sidebar.tsx`) every single dashboard route already goes through, so fixing it there fixes all of them at once.

### The sidebar becomes an off-canvas drawer below `md`, not a second layout
`Sidebar` now takes `mobileOpen`/`onClose` props from `layout.tsx` (which owns the state, since it also owns the header's new hamburger button). Below `md` it's `fixed` and `-translate-x-full` at rest, sliding to `translate-x-0` with a dismissible backdrop when opened; at `md` and up it reverts to exactly the original always-visible, in-flow rail — verified pixel-identical to the pre-fix desktop screenshot, zero behavior change for the layout every existing phase's own live verification already ran against. The drawer closes itself on its own `pathname` change (a `useEffect`, not a click-handler special case) so tapping any real nav link both navigates and dismisses in one action — confirmed live, not assumed, since a naive `isVisible()` check on a `translate-x`'d element reports `true` (Playwright's visibility check ignores transforms) and would have passed even if the drawer never actually closed; verification was redone against the element's real bounding-box position instead.

### The header sheds everything except the current page name below `sm`
"Roomick", the branch name, and the section-link segment of the breadcrumb are all `hidden sm:inline` now — at a phone's width the only thing worth the space is which page you're on, not the full trail. The breadcrumb container also gained `overflow-hidden` so anything that still doesn't fit clips cleanly instead of visually overlapping the header's own right-hand controls, which is what was actually happening before (not literal page-level horizontal scroll — a `flex` container whose children are all `shrink-0` just overflows in place instead of triggering a scrollbar).

### Verified
Live Playwright at a 375×812 viewport across Front Desk, Room Status Board, Arrivals, Task Board, Walk-In Booking, and Guest Folio: confirmed zero horizontal overflow (already true before, and still true), and — this time by screenshot, not just the metric — confirmed the header and content are both fully legible and usable, not squeezed. A dedicated drawer-behavior spec (4/4 checks) confirmed the sidebar sits off-screen by default, slides fully on-screen on tap, and auto-closes after a real in-drawer navigation. A separate 1440px desktop pass confirmed the hamburger button stays hidden and the sidebar stays static/in-flow at its original position — the fix is additive, not a rewrite of the working desktop layout.

### Carried forward
- Everything from the backend's own Production Readiness PHASE_NOTES entry — the persisted e2e suite, RBAC boundary tests, Sentry backend scaffold, and the explicitly-deferred backups/frontend-Sentry/uptime-monitoring items.
- This pass fixed the shared SHELL, not every individual page's own internal layout — a page with its own dense internal grid (a wide table, a multi-column form) may still want page-specific mobile polish later; none of the six pages checked here needed any.

## Phase 41 — Production Readiness (Month 6): frontend Sentry, resolved (2026-08-28)

Last phase's own backend Production Readiness entry deliberately left frontend error tracking undone — `@sentry/nextjs`'s bundled README only documents the interactive `npx @sentry/wizard` flow (needs a real Sentry login this environment can't do), and hand-wiring it from memory risked guessing wrong against Next.js 16.3's very recent `instrumentation-client.ts` convention. Rather than leave that gap standing, looked it up properly this time — a live fetch of Sentry's own current manual-setup docs gave the complete, current, verifiable file layout, closing the gap the same session it was named.

### Five new files, all DSN-gated the same way the backend's `src/instrument.ts` already is
`instrumentation-client.ts` (browser init, gated on `NEXT_PUBLIC_SENTRY_DSN` — this one has to be the public-prefixed var, since it's the one file in this list that actually runs in the browser and Next only inlines `NEXT_PUBLIC_*` into client bundles), `sentry.server.config.ts` and `sentry.edge.config.ts` (gated on plain `SENTRY_DSN`), `instrumentation.ts` (Next's own hook, loads whichever of the previous two matches the live runtime — always present regardless of Sentry, but has nothing to gate itself since both files it loads already no-op on their own), and `app/global-error.tsx` (the root error boundary Next.js requires for capturing a crash in the root layout itself — `Sentry.captureException` is a documented-safe no-op call with no init, so this file needs no gating either). `next.config.ts`'s own `withSentryConfig()` wrap is the one exception gated at a different layer: skipped entirely — not just handed an empty DSN — when `SENTRY_DSN` is unset, so an unconfigured build never even invokes Sentry's own webpack/turbopack plugin.

### Verified both states, the same way the backend pass was
A production build with `SENTRY_DSN` unset produced the identical 35-route output as before this phase touched anything. A second build with a syntactically valid but fake DSN (plus fake `SENTRY_ORG`/`SENTRY_PROJECT`) also succeeded cleanly — same 35 routes, Sentry's own build hooks visibly running (`clientTraceMetadata`, `runAfterProductionCompile`) without error, which is meaningful because Next's static generation step actually executes every page's server-side render during the build itself — proof `sentry.server.config.ts`'s `Sentry.init()` runs cleanly under real (if fake-credentialed) conditions, not just that the file parses. A live dev-server boot check with the fake DSN was attempted but blocked by Next.js 16's own single-instance-per-directory guard, which refuses a second `next dev` from this project directory regardless of port — correctly refused rather than working around it by touching the user's own already-running session; the build-time SSG pass already exercises the same server-init code path a dev boot would.

### Carried forward
- Everything from the backend's own Production Readiness entry — unchanged. With this, frontend error tracking is no longer a Month 6 gap; only backups and uptime monitoring remain, both genuinely blocked on infrastructure this environment doesn't have (a `pg_dump` binary and real S3/monitoring-service credentials, respectively).

## Phase 42 — Real PDF downloads for Registration Cards and Reports (2026-08-28)

The backend's own "Closing Month 1–6 gaps" pass added real PDF generation (`pdfkit`) behind two new routes — `GET /registration-cards/:id/download` and `GET /branches/:branchId/reports/<type>/pdf`. This phase is the minimal frontend surface for both: real download buttons where a `window.print()`/CSV-only stand-in previously was.

### `downloadFile` — a second fetch helper, because `apiFetch` can't do this
`apiFetch` (`lib/api.ts`) always calls `response.json()` — no way to hand it a binary PDF response. `downloadFile(path, filename, auth)` is a small sibling: the same base URL and `Authorization`/`X-Tenant-ID` headers, but reads a `Blob` and triggers a normal save via a throwaway `URL.createObjectURL` + `<a>` click — necessary because a plain `<a href>` can't carry those auth headers itself, and this project's API requires them on every route.

### Registration Card page
The page's own header comment previously named `window.print()` as "the closest thing to a downloadable PDF this pass offers" — now stale, since a real generated PDF exists. A `Download PDF` button sits next to the page header (works for both a signed card — the persisted, encrypted document — and an unsigned one, which the backend renders live as a preview); `Print` stays alongside it as the quick same-tab option, not replaced.

### Reports page
`reportPdfPath(branchId, type, params)` added to `lib/reports.ts`, mirroring the file's own existing `useXReportQuery` URL-building exactly (same `reportQueryString` helper, just `/pdf` appended). An `Export PDF` button next to the report-type tabs downloads whichever report is currently selected, with its current date range/group-by/room-type filters — a page-level export of the full report, distinct from (and additive to) the per-table `Export CSV` buttons `BreakdownSection` already had.

### Verified
`npx tsc --noEmit`, `eslint` (both clean) on every touched file. `npm run build` — all 35 routes, unaffected. Not live-clicked in a running browser this pass (no dev server verification round for these two buttons specifically) — worth a quick manual check before this is considered fully proven, though both routes are exactly what the backend's own registration-cards/reports test suites already exercise directly.

### Carried forward
- ID-document capture has no frontend surface yet — the backend now accepts `idDocument` on check-in/walk-in (`RecordIdDocumentDto`) and exposes a masked/reveal read at `GET /guests/:guestId/id-document`, but no page collects it. The Check-In Flow page (ref p16) is the natural place — its own reference spec already names "ID document upload / camera capture" as a UI component.

## Phase 43 — ID Capture on Check-In Flow, and a real Back button for every drilled-into page (2026-08-29)

Two loose threads closed together: the previous phase's own "carried forward" note (ID-document capture has no frontend surface) and a direct user request — pages reached by clicking into a row from a list (Check-In Flow, Registration Card, Guest Folio) had no way back except the browser's own button.

### `BackButton` (`components/ui/`) — one component, `router.back()`, not a hardcoded route
Sits above `PageHeader` on any page you drill INTO rather than navigate to directly from the sidebar. `router.back()` rather than a fixed destination — correct regardless of which list (Arrivals, In-House Guest List, Billing) the page was actually entered from; a `fallbackHref` prop covers the one edge case `back()` can't (a deep link opened with no prior history). Wired into Check-In Flow, Registration Card, and Guest Folio. While touching Registration Card's header anyway, fixed a real regression from the prior phase: the `Download PDF` button had been added by wrapping the ENTIRE `PageHeader` (title included) in `print:hidden`, which would have hidden the page title on a real print, not just the button — `PageHeader`'s own `actions` prop (already used correctly by the Guest Folio page's `Close Folio` button) is the right place for it, and now is.

### ID Capture — `RecordIdDocumentDto` fields, `LogoUpload` reused for the photo
`ID_DOC_TYPES`/`IdDocumentInput` added to `lib/guests.ts`, mirroring `RecordIdDocumentDto` (roomick-pms-backend) exactly; `useCheckInMutation` now accepts an optional `idDocument`. The form itself — ID Type, ID Number, Expiry Date, Nationality, ID Document Photo — sits in its own Section on the Check-In Flow page, explicitly labeled optional and never validated into blocking Confirm Check-In (both-or-neither validation only fires if the agent starts filling ID fields and stops halfway). The photo field reuses `LogoUpload` as-is — its own style-guide entry already had an "ID Upload" example with the exact right hint text, suggesting the design system anticipated this exact reuse. `fileToBase64` (a small `FileReader.readAsDataURL` wrapper stripping the `"data:"` prefix) is the one new piece of client-side plumbing, since the backend's `photoBase64` field expects raw base64.

### Verified live, end-to-end, against the real running app — not just build/lint
Both backend (`localhost:3000`) and frontend (`localhost:3001`) dev servers were already running against a real local Postgres 18; rather than guess from a static build, a Playwright script self-provisioned a fresh tenant through the real public API (register → verify-email → login → configure-mode → branch → room type → rooms → a confirmed reservation — the same pattern the backend's own e2e suite uses), then drove the actual browser: logged in through the real `/login` form, opened Check-In Flow, confirmed the Back button, filled every ID Capture field including a real PNG file upload, selected a room, and clicked Confirm Check-In. 16/16 checks passed: the redirect to Registration Card landed correctly (with its own working Back button), the Guest Folio (reached via Billing → View Folio) showed its Back button and the correct real room charge, zero browser console/page errors the whole way through, and — the part that actually proves the backend round-trip, not just that a form submitted — `GET /guests/:guestId/id-document` came back with `idDocNumber: "••••4567"` (masked) by default and the real `"P1234567"` only with `?reveal=true`, exactly as designed.

### Carried forward
- Nothing new. This closes both items the prior two phases had named as open.

## Phase 44 — Alerts: missed check-ins, overdue checkouts, overdue balances (2026-08-29)

Reported directly against the running app: a guest checked in the day before, viewed the next day, well past checkout — nothing anywhere said so. Backend built a real `AlertsService` (see roomick-pms-backend's own PHASE_NOTES entry for the full design, ported from the in-house PMS's own Alerts feature and adapted to Roomick's real per-branch timezone/clock-time model instead of that reference's hardcoded noon-Lagos assumption). This phase is the frontend surface for it.

### `lib/alerts.ts` — one query, shared by every consumer
`useAlertsQuery(branchId, auth)` polls `GET /branches/:branchId/alerts` every 60s (`refetchInterval` — the idiomatic TanStack Query equivalent of the reference's own websocket-plus-polling-fallback delivery, since this codebase has no real-time push infrastructure to build the fuller version on). One query key (`['alerts', branchId]`) used by both the sidebar badge and the dedicated page, so having "two consumers" never means two network requests — TanStack Query dedupes the identical key.

### Sidebar — a standalone link, not a `TopLevelSection`
Every existing top-level nav entry (Reservations, Housekeeping, Billing and Payments, Reports and Analytics) is a `TopLevelSection` that collapses to a row and expands into a box of child pages — built for sections with *multiple* pages to reveal. Alerts has exactly one destination, so forcing it through that same expand-to-a-box machinery would have rendered a box with one child pill in it, which reads as broken, not minimal. `AlertsLink` is a new, much simpler standalone component: a plain link styled identically to a collapsed section row at rest, `bg-primary`-filled when it's the open page (the same "you're on this single page" language `LeafPill` already uses elsewhere), plus a live red count badge. Placed right after Front Desk in the sidebar — alerts aggregate across both front-desk and billing concerns, so it doesn't obviously belong nested under either.

### `/dashboard/alerts` — three tabs, each row links straight to where it resolves
Missed Check-Ins → Check-In Flow for that reservation; Overdue Checkouts → Check-Out Flow (a flat guest-picker page, not a per-reservation route, so this links to the page rather than a specific id); Overdue Balances → that folio's own Guest Folio page. No dismiss button anywhere — matching the backend's own design, a row disappears only because the real underlying reservation/folio actually changed, never because someone clicked it away.

### Verified live, reproducing the exact reported bug
Dev servers were already running against real Postgres. A Playwright script self-provisioned a fresh tenant via the real API, created a reservation checked in two days ago with a checkout date of yesterday, and checked it in for real — the exact "checked in on the 28th, nothing flags it on the 29th" scenario reported. Then logged in through the real `/login` form: the sidebar's Alerts badge showed a live, correct count; the Alerts page's Overdue Checkouts tab showed the guest with the right room and scheduled checkout date and a working "Check Out" button; a second scenario (a confirmed reservation never checked in) correctly appeared under Missed Check-Ins. This same run is what caught the backend's `city_ledger` double-counting bug (see its own PHASE_NOTES entry) — the total came back as 3 before that fix, 2 after, confirmed live against the real running app, not just in a unit test. Zero console/page errors throughout.

### Carried forward
- No websocket push, so an alert can take up to 60s to appear after the underlying state actually changes — see the backend's own note on this tradeoff.

## Phase 45 — A batch of real usage feedback: capacity, dropdowns, dates, camera ID capture (2026-08-29)

Several distinct issues reported from actually using the app in one sitting, plus a research pass against the in-house PMS for anything worth porting (see backend PHASE_NOTES for the full comparison — two of these six fixes came from patterns confirmed already solved there; the other four had no existing pattern to copy and needed building from scratch).

### `Select` dropdown — fixed the "must click away before reopening" bug
Root cause, found by reading the component rather than guessing: selecting an option calls `inputRef.current?.focus()` (so the field stays keyboard-navigable), but the trigger only ever opened via `onFocus` — and a second click on an *already-focused* input never fires `onFocus` again. Fixed with an `onClick` handler that opens unconditionally, independent of focus transitions. Per the research: the in-house PMS's own hand-rolled popup (a date picker) avoids this class of bug entirely with a plain click-toggle and never relies on focus/blur — the same principle this fix applies. Also simplified `onChange` to only filter once already open, since opening is fully `onClick`/`onFocus`/arrow-keys' job now, not a keystroke's side effect.

### Room-type capacity: live warning, backed by a real backend cap
`CapacityWarning` (`app/dashboard/_components/`) — a plain echo of the backend's own `assertWithinCapacity`, shown live as an agent types adults/children, before they ever hit submit. Wired into Create Reservation, Walk-In Booking, and Modify Reservation. `RoomTypeSummary` gained a typed `capacity` field — the backend's `listRoomTypes` already returned it (no `select` clause), it just was never typed on this side.

### Check-in/check-out date fields now auto-advance correctly
Reported: picking a new check-in date left check-out wherever it was previously set, so a 1-night stay moved from the 10th to the 15th stayed checked out on the (now nonsensical) 11th. New shared `lib/dates.ts#dayAfter` helper; a `useEffect` on each of Create Reservation / Walk-In Booking / Modify Reservation auto-advances check-out to check-in + 1 day, but ONLY when the current check-out is missing or no longer valid — a deliberately longer, still-valid stay is left alone. This is the exact same design the in-house PMS's own `Root.jsx` already uses (`handleSetCheckInDate`/`handleSetCheckOutDate`) — confirmed via the research pass before writing this, not arrived at independently.

### Add Charge form (Guest Folio) — date now genuinely defaults to today, form clears after submit
The field's own hint already claimed "Defaults to today," which was false — the field was just empty. Now genuinely defaults on mount and after every successful submit (charge type carries over for posting several of the same kind in a row; description/amount/date all clear). The backend's own `postCharge` already defaulted an omitted `serviceDate` to branch-timezone "today" server-side — this fix is purely about the visible form UX matching what staff were told to expect, not a correctness gap in the API.

### ID Capture — camera-first, and a real country dropdown for nationality
Raised directly: front desk is holding the guest's own physical ID at the counter — a file-picker implying "upload from your device" was never the right model. New `CameraCapture` component (`getUserMedia` → live preview → `canvas`-snapshot capture → retake) replaces the file-upload-only picker; a plain "or upload a photo instead" link stays as a fallback for no-webcam/denied-permission cases. Nationality changed from a free-text 2-letter box to a real searchable dropdown using the `COUNTRIES` list (`lib/countries.ts`) that already existed for onboarding's own country field — no new dataset needed, just reused. The in-house PMS has no ID capture at all (camera or upload) to compare against, per the research pass — this is new territory for both systems.

### `ForwardButton` — `BackButton`'s missing companion
Raised directly: a `Back` button was added to detail pages last phase with nothing to go forward with. `ForwardButton` (`router.forward()`) sits beside `Back` on the same three pages (Check-In Flow, Registration Card, Guest Folio).

### The Sign button, clarified rather than changed
Asked directly what "Sign" does and whether re-signing should be allowed. Answered: it permanently saves the signature and generates the encrypted PDF in one step; re-signing is deliberately blocked (409) as a "legal document, not a silently editable one" design from an earlier phase. Given three options (keep as-is / allow overwrite / allow versioned re-sign), the answer was to keep it as-is — no code change.

### Verified live, end-to-end, against the real running app
Dev servers were already running against real Postgres. One Playwright pass covering all of the above: created a reservation exceeding a deliberately small (2 adult/1 child) room type's capacity and confirmed the API's 400 (with the exact numbers in the message) and the live warning text; picked a room type in the `Select` dropdown, immediately clicked the trigger again with no intervening click, and confirmed it reopened; changed a check-in date and confirmed check-out auto-advanced to the following day; opened a real (fake, in test) camera device end-to-end — live preview rendered, Capture produced a static snapshot, Retake appeared — using Chromium's `--use-fake-device-for-media-stream` flag; confirmed the nationality field is a real searchable country list. Zero console/page errors throughout, 11/11 checks passed.

### Carried forward — two open items, not decided yet
- **Group check-in** — raised directly ("we have folio splitting on one reservation, but no group check-in"). Confirmed via the research pass that the in-house PMS doesn't have this either (an explicit unbuilt roadmap item there too) — this is real, novel design work for both systems, not a quick add. Needs its own scoping conversation before starting.
- **Guest Profiles & CRM** — raised directly ("we don't have a guest list to view guest profiles"). Confirmed this is a fully specced page in the reference architecture (`pms-frontend-structure-2.html`, route `/[brand]/[branch]/guests`, "Full profile: preferences, history, spend") that was simply never built in the MVP — `GuestProfile`'s own preferences/VIP/tags/loyalty fields sit unused in the schema with no list endpoint or page surfacing them. A real, scoped gap, not new territory — just not started yet.

## Phase 46 — ID Capture on Walk-In Booking too (2026-08-29)

Asked directly: "why is there no ID capture on walk-in bookings?" Answer, found by checking the code rather than guessing: it wasn't a design choice — `WalkInReservationDto` (backend) has accepted `idDocument` since the SAME pass that built Check-In Flow's own ID Capture section, and `ReservationsService.walkIn` already calls `recordIdDocumentInTx` when it's given one. The frontend form for it just never got built here, even though a walk-in's immediate branch IS an in-person check-in — the exact case ID Capture exists for. The page's own header comment still claimed the ID-capture infrastructure didn't exist yet; it was simply stale.

### Fixed — the identical ID Capture section from Check-In Flow, ported over
Same fields (ID Type, ID Number, Expiry Date, Nationality via `COUNTRIES`, `CameraCapture` for the photo), same both-or-neither validation, same "optional, never blocks" framing — shown only in the walk-in's *immediate* branch, never the book-ahead one. That distinction matches the backend exactly: `CreateReservationDto` (the book-ahead path) has no `idDocument` field at all, because the guest isn't physically present yet to show one — there was nothing to add there. `useCreateWalkInMutation` gained the `idDocument` field it was missing to actually send this through.

### Verified live, end-to-end
Same real-Postgres + fake-camera-device setup as the prior phase. Filled the walk-in form for an immediate check-in, including a real camera capture, submitted, and confirmed via the API that the guest's ID document came back with the right type (`national_id`) and nationality (`GH`), masked by default (`••••8776`) and correctly revealed (`N9988776`) with `?reveal=true` — the identical round-trip already proven for Check-In Flow, now proven for this second entry point too. 9/9 checks passed, zero console errors.

## Phase 47 — Night Audit checklist detail text was too faint (2026-08-29)

Reported against a real screenshot: the sub-text under each Pre-audit Checklist row ("1 still in-house past check-out," "Maintenance module not built yet") was hard to read. `ChecklistRow`'s detail line was plain `text-secondary-light` — a fixed pale lavender-gray token (`#a698b2`), not an opacity setting, so there was technically nothing to "increase"; the real fix is more visual weight while staying clearly secondary/muted, not full body-text darkness. Swapped to `text-secondary/60` — a partial opacity of the dark `secondary` color, the same mechanism `WizardShell.tsx`'s own `text-secondary/70` "active but muted" tab state already uses elsewhere in the app, just a step lighter since this is a passive caption rather than something the user is actively on. Verified live with a screenshot reproducing the exact reported scenario (an overdue in-house guest, both unbuilt-module rows) — clearly more legible, still visually secondary to the bold labels above each line.

## Phase 48 — Language dropdown, and a real contrast bug in `YesNoToggle` (2026-08-29)

Two small, direct reports. First: the Registration Card template's "Language" field was a free-text box (placeholder `"en"`) — should be a dropdown. Grepped the whole frontend for every "language" field first rather than fixing just the one visible in the screenshot; it's the only real one that exists (the other two grep hits were a type declaration for the same field and an unrelated comment). New `lib/languages.ts` (`LANGUAGES`, ISO 639-1 codes, same file convention as `lib/countries.ts`) — a curated common-language list, not the full ~180-language table, since a hotel template only ever needs languages guests/staff actually read. The backend's `RegCardTemplate.language` has no server-side enum, so this is a frontend-only curation; any 2-letter code still round-trips fine if ever needed.

Second: "make sure our yes/no toggles have white text on the active (primary-colored) option." Root cause: `YesNoToggle`'s selected state was `bg-primary text-secondary` — a near-black-purple text color on a solid gold fill, while every other primary-filled control in the app (`Button`, `AutoLoginStep`, `WizardShell`'s active tab) already correctly uses `bg-primary text-white`. Grepped for the same `bg-primary text-secondary` pattern elsewhere first — `YesNoToggle` was the only offender; fixed to match the established convention.

### Verified live
Registration Card template page: the Language field is a real combobox listing actual language names, selecting "English" works and persists in the form. Computed the selected "Yes" pill's actual rendered text color via the browser (`getComputedStyle`) rather than eyeballing a screenshot — confirmed `rgb(255, 255, 255)`, true white, not an approximation. 3/3 checks passed.

## Phase 49 — Sidebar restructured to the architecture map's real Operations/Management/Admin grouping (2026-08-29)

Called out directly, against two screenshots of `pms-frontend-structure-2.html`'s own sidebar: the app's real sidebar had no Operations/Management/Admin section separation at all, and — the sharper point — nothing beyond Operations had ever been built. Read that file's actual nav markup directly (`nav-section`/`nav-item` elements, lines 444-533) rather than trusting the two screenshots alone, since a screenshot can be a scrolled/partial view. That gave the exact, complete, ordered list this phase is built against — not a guess at what the dark mockup implied.

### What the map actually is, and what it isn't
`pms-frontend-structure-2.html`'s own tagline is "Frontend Architecture" — this sidebar is the product's full page *inventory* and its three-tier grouping, not a visual skin to copy. Roomick's own gold/cream design language (from `Roomick-UI.pdf`, the actual pixel reference every built page already matches) is untouched here — only the *information architecture* (which pages exist, which of the three sections each belongs to) needed to catch up to this file.

### What was genuinely just miscategorized — moved, not built
Cross-referenced the map against Roomick's actual current pages (backend routes + frontend files) before touching anything, model by model:
- **Overbooking Mgmt** — a full real page (`/dashboard/overbooking`) that existed, previously nested under Reservations only because no Management section existed yet to hold it. Moved.
- **Rate Resolver** — the map's own page (`id="page-rateresolver"`) describes it as a "System — Backend Service," not a distinct UI screen: `RateResolverService`'s `POST /rate-resolver/calculate` is exactly that service, already built, already the sole source of every price the UI shows (never recalculated client-side) — this was true before this phase and stays true. The one real screen that configures it is Rate Plan Management (`/dashboard/reservations/rate-plans`) — relabeled to the map's own "Rate Resolver" name and moved here from Reservations, rather than inventing a second, redundant page.
- **Reports & Analytics** — was its own top-level section (a leftover from before Management existed); the map places it under Management, peer to Revenue Management/Guest CRM/etc. Folded in as a nested group (Operational Reports real, Financial Reports/Custom Report Builder still the same inert placeholders they always were).

### What's a real, confirmed gap — added as honest placeholders, not built
Checked each one directly rather than assuming — no page, no route, nothing partially there for any of: **Manager Dashboard, Guest Profiles & CRM, Revenue Management, Sales & Events, Maintenance, Loyalty & Marketing** (Management), and **Property Config, Integrations & APIs, Security & Roles, System Admin, Enterprise/HQ** (Admin, confirmed empty end to end — no settings page since onboarding, no staff/role-permissions UI beyond the `@Roles` guards themselves, no backup/system-health screen, no cross-branch view). All 11 render as genuine inert rows — Roomick's own long-established "not built yet" pattern (the same one `Folio Transfer`/`Point of Sale`/`Refunds and Corrections` already used), not silently invented pages or fake data.

### `Sidebar.tsx` changes, mechanically
`TopLevelSection.href` is now optional — a section with zero real pages under it (Admin, today) renders as a single inert row instead of a dead link, using the exact same `InertRow` component every other placeholder already does; it starts behaving like every other section the moment its own first real page exists. New `SidebarGroupLabel` for "OPERATIONS"/"MANAGEMENT"/"ADMIN" reuses `Section.tsx`'s own established small-caps label style verbatim (`text-tiny font-bold uppercase tracking-wide text-primary-dark/50`) rather than inventing a second header look for the same idea. `Management`'s own 9 items (including the nested Reports & Analytics group) reuse the SAME `SectionItem`/`GroupRow`/`LeafPill` machinery `BILLING_SECTION` already established — no new rendering logic needed, only new data. `layout.tsx`'s breadcrumb `SECTIONS` map updated to match exactly (`/dashboard/reservations/rate-plans` now resolves to "Management," listed before the broader `/dashboard/reservations` prefix so `Array.find` doesn't match the wrong one first).

### Verified live
Logged in through the real UI: confirmed all three section labels render, confirmed Management expands to show all 9 items with the right real/inert split, confirmed clicking "Management" navigates to its real hub (Overbooking) and the breadcrumb now reads "Management" instead of the old "Reservations," and confirmed Admin renders as a single genuine inert row. 12/12 checks passed, zero console errors. Screenshots also incidentally re-confirmed the `YesNoToggle` white-text fix from the prior phase, visible on the real Overbooking Management page.

### Carried forward — the actual size of what's left, stated plainly
Fixing the *structure* took one file. The 11 placeholder rows this phase made visible are each a real subsystem, not a page-sized task — several (Guest CRM, Maintenance, Revenue Management, Loyalty & Marketing, Security & Roles, System Admin, Enterprise/HQ) need real backend design (new models, new services) before any frontend page has something to call. Not scoped or sequenced yet; worth a dedicated planning pass, not a "build all of Management next" instruction taken at face value.

## Phase 50 — Extend Stay (2026-08-29)

Requested directly: the In-House Guest List should show when a guest is due out and let front desk extend them from there; the Departures Dashboard needs the same action for a guest at the desk who decides to stay longer instead of checking out.

### Backend groundwork this depended on
`ReservationsService.extendStay` (new) — deliberately not a loosened `modifyReservation`, which explicitly refuses a `checked_in` reservation because it needs folio reconciliation that method never handles. The new method only accepts one field (a `checkOutDate` strictly after the current one) on an already-`checked_in` reservation, re-checks both the room-type pool and the specific assigned room for the extension window, and — the part that mattered most — re-resolves the rate through `RateResolverService.resolveStay` over the FULL check-in→new-checkout range rather than appending a flat amount to the old total. That distinction exists because the in-house PMS's own `docs/LESSONS-LEARNED.md` names the exact bug an append-only extension causes: charges accrue per-night as `confirmedRate / nights`, so an extension that doesn't rewrite `confirmedRate` silently undercharges every future night. Full reasoning in the backend's own `PHASE_NOTES.md`.

### `ExtendStayDialog` — one shared component, two entry points
`app/dashboard/_components/ExtendStayDialog.tsx`, built on the existing `Modal` primitive (same one `ConfirmDialog` uses) rather than a one-off: a single date field defaulting to the day after the reservation's current checkout (`dayAfter`, the same helper Create/Walk-In/Modify already share), a short explanation that the rate re-resolves over the whole stay so the total visibly changes, Cancel/Extend Stay buttons. Takes a `target: {id, guestName, checkOutDate} | null` plus `branchId`/`auth` and calls the new `useExtendStayMutation` (`lib/reservations.ts`, same shape as every other reservation mutation here — invalidates arrivals/departures/in-house/search/availability-calendar on success).

- **In-House Guest List**: already had a Check-Out Date column (the "due out" visibility asked for) — gained an "Extend Stay" button beside "View Folio" in the Action column.
- **Departures Dashboard**: gained "Extend Stay" beside "Check-Out." No extra logic needed for a guest to correctly drop off today's list once extended — `useDeparturesQuery` is already scoped to a specific date, so the existing mutation-success invalidation refetches it and the guest simply no longer matches.

### Verified live
Self-provisioned a tenant against the real backend, checked in a 2-night stay, and drove the actual API first: confirmed extending a `confirmed` (pre-check-in) reservation is rejected, confirmed a same/earlier checkout date is rejected, blocked the assigned room across part of a proposed extension and confirmed THAT'S rejected even with room-type pool space available, then extended for real and confirmed the returned `confirmedRate` was the fully re-resolved 5-night total (150000), not the original 2-night total plus a bolted-on amount — with a `stay_extended` entry in the comms log. Then drove the real browser: opened the dialog from the In-House Guest List, extended a second time, and confirmed both the page and a follow-up API call agreed on the new date and the newly re-resolved total; separately checked in a guest due out today, extended them from the Departures Dashboard, and confirmed they disappeared from today's departures list once their checkout moved into the future. 25/25 checks passed, zero console/page errors.

## Phase 51 — Manager Dashboard, first of 11 scoped Management/Admin gaps (2026-08-29)

Phase 49 surfaced 11 confirmed real gaps as honest inert placeholders rather than building any of them silently. Asked directly to scope, sequence, and begin implementing them — the sequence (documented in this session, not yet its own file) orders items by how much backend already exists underneath: Manager Dashboard first (Operations Overview and Staff Management both compose fully-existing endpoints; only Rate Override needed new backend work — see the backend's own `PHASE_NOTES.md`), then Security & Roles, Property Config, Maintenance, Guest Profiles & CRM, System Admin, and a display-only Loyalty slice — Revenue Management/Sales & Events/Integrations & APIs/Enterprise-HQ deferred as needing real new domain design, not a quick wrap.

### Built against the architecture map's own spec, not a guess
`pms-frontend-structure-2.html`'s `page-manager` section names exactly three feature cards — Operations Overview (`GET /branches/:branchId/dashboard/live`, described as KPI stat cards + arrivals/departures counts + outstanding balances + maintenance alerts + a room-status mini-map), Rate Override, and Staff Management — read directly before writing anything, the same discipline Phase 49 established. Rather than build a new `/dashboard/live` aggregate endpoint, Operations Overview composes the SAME hooks the Front Desk hub and Reports page already use (`useOccupancyReportQuery`/`useAdrReportQuery` scoped to today, `useAlertsQuery`, `useArrivalsQuery`/`useDeparturesQuery`/`useInHouseQuery`, `useFoliosQuery(branchId, 'outstanding')` summed, `useRoomsQuery` for both the dirty-room count and a compact `RoomStatusMiniMap` reusing `deriveRoomStatus`/`STATUS_STYLES` at a glance-only dot scale) — one new small `KpiCard` local component, matching the one Reports' own page already established, zero new query hooks needed for this section. "Maintenance alerts" is shown honestly as not-yet-tracked (no Maintenance module exists yet) rather than faked into the generic alerts count.

### `lib/staff.ts` (new) — wraps P1's fully-built, never-surfaced staff endpoints
`useRolesQuery` (`GET /auth/roles`), `useStaffQuery` (`GET /branches/:id/staff`), `useBulkInviteMutation` (`POST /branches/:id/staff/invite` — sends a single-row array; the backend's own bulk shape is preserved for a future multi-row invite UI, not narrowed), `usePatchStaffMutation` (`PATCH /staff/:userId`, used here only for the `active` toggle). The Staff Management section is a `Table` (name, email, role badges, last login, an Active/Deactivate toggle button) plus an `InviteStaffModal` (email + a real role dropdown sourced from `GET /auth/roles`, not a hardcoded list).

### Rate Override — a small reservation-search-then-edit flow
No dedicated reservation-picker component existed for "find one specific reservation and act on it" outside a full page flow, so `RateOverrideSection` builds the smallest version: a live search (reusing `useReservationsQuery`'s existing `search` filter) rendering matches as clickable rows, then a form showing the CURRENT computed nightly rate (`confirmedRate / nights`, for context) beside a new-rate input and a required reason, calling the new `useSetRateOverrideMutation`. The "folio impact preview" the reference names is this current-vs-new nightly rate framing — not a live re-scan of already-posted line items, which stay untouched by design (see the backend's own note on why).

### A real accessibility bug caught and fixed, not test-only
Every new `Input` in this phase (`ExtendStayDialog`'s date field from Phase 50, this phase's rate/reason/email fields) was written without an explicit `id`, which `Input.tsx`'s own code sets `fieldId = id ?? name` — undefined when neither is passed, meaning the rendered `<label>` was never actually associated with its `<input>` via `htmlFor`/`id`, despite looking correct visually. Caught by a live `getByLabel` Playwright lookup timing out, not by inspection — the same "verify against the real running page, not just a screenshot" discipline this project has held to throughout. Fixed by adding explicit `id`s to all four fields; this is a real screen-reader/label-click regression that would have shipped invisibly otherwise, not a test-only nuisance.

### A lint rule caught a second real issue while fixing the first
Re-running lint after the `id` fixes surfaced `react-hooks/set-state-in-effect` on `ExtendStayDialog`'s own `useEffect` (from Phase 50) — calling `setCheckOutDate`/`setError` synchronously inside an effect body to re-sync state when the `target` prop changed. Restructured per React's own documented pattern for "resetting state when a prop changes": the outer `ExtendStayDialog` now renders a keyed `ExtendStayDialogInner` (`key={target.id}`), so switching to a different reservation remounts fresh state via a lazy `useState` initializer instead of an effect chasing a changing prop. Re-verified Phase 50's own 25-check live suite afterward to confirm zero regression from the refactor.

### Verified live
`npx tsc --noEmit`, `eslint` (0 errors after both fixes above), `npm run build` (all 37 routes compile, `/dashboard/manager` included). Live against real Postgres: registered a tenant, created 5 rooms and checked one guest into one of them, marked a second room dirty — confirmed via the real browser (navigated through the sidebar, not a direct URL) that Occupancy Today read the correct 20% (1 of 5 room-nights sold), ADR/Rooms-Dirty/Arrivals/Departures/In-House/Outstanding-Balances all matched real numbers, and the room-status mini-map rendered one dot per room. Selected a reservation via the search box, saw its real current nightly rate, submitted an override through the UI, and confirmed via a follow-up API call that it persisted exactly as entered. Opened the Invite Staff modal, confirmed the role dropdown listed real tenant roles (not a hardcoded list), sent an invite, and confirmed via the API that an invite record was created without prematurely creating an active user. 20/20 checks passed, zero console/page errors.

### Carried forward
10 of the 11 gaps remain, sequence documented above — Security & Roles is next.

## Phase 52 — Security & Roles: Permission Matrix, Audit Log Viewer, GDPR Compliance (2026-08-29)

Second of the 11 Management/Admin gaps, built at `/dashboard/security`. Unlike Manager Dashboard, two of the three feature cards needed genuinely new backend modules — see the backend's own `PHASE_NOTES.md` for `audit-logs`/`gdpr`.

### Three sections, three different levels of "how much already existed"
- **Role & Permission Matrix** — 100% composed from existing endpoints (`GET`/`PUT /auth/roles`). No canonical module × action list exists anywhere backend-side (`Role.permissions` is a free-form `{module: [actions]}` map), so `PERMISSION_MODULES`/`PERMISSION_ACTIONS` name the app's actual real domains rather than inventing an abstract taxonomy. A role picker (`Select`, sourced from `useRolesQuery`) plus a real checkbox grid — toggling a cell calls `useUpdateRolePermissionsMutation` immediately, no separate save step. The section's own copy is explicit that this is stored/audited but NOT yet enforced (`RolesGuard` still gates on role name), matching this project's established honesty about partial features rather than implying more than what's real.
- **Audit Log Viewer** — a new `lib/auditLogs.ts` hook over the new backend endpoint. Filters (action substring, from/to date) drive the query directly; a `Before / After` column renders each row's JSON diff behind a click-to-expand toggle rather than a separate modal, since most rows have nothing to show. **The CSV export button was removed after being written** — `Table.tsx` already has its own built-in CSV export (`exportFileName` + each column's `exportValue`/`sortValue`), and a second, hand-rolled `downloadCsv` button duplicated exactly what that component already does. Caught while reviewing the live screenshot (two export buttons visibly stacked on the same table), fixed by adding `exportValue` to the two columns that needed it (Entity, IP Address) and deleting the redundant button/helper entirely — simplification over duplication, the same call this project has made before.
- **GDPR Compliance** — a guest-search-then-file form (reusing the Rate Override section's own "search, pick one, act on it" shape from Manager Dashboard) plus a request tracker table with a live days-remaining countdown (red once overdue) and a Download Export action. No dedicated Guest Profiles page exists yet (a separately-tracked, still-open gap) — a small `useGuestSearchQuery` wrapper around the existing `GET /guests/search` was added to `lib/guests.ts` just for this form's own need, the same minimal-reuse call Rate Override made for reservation search rather than waiting on the full CRM page.

### Verified live
`npx tsc --noEmit`, `eslint` (0 errors after the CSV-export cleanup), `npm run build` (`/dashboard/security` compiles, 38 routes total). Live against real Postgres, API first: fetched the 6 seeded roles, PUT a permission change onto `manager` and confirmed it round-tripped; filed both an access and an erasure GDPR request for a real guest, confirmed exporting the erasure one is rejected while the access one downloads a real file containing the guest's actual name, confirmed the request auto-completes once exported, manually progressed the erasure request to completed and confirmed a further status change is correctly rejected as terminal, confirmed all three new audit actions appear via the new `/audit-logs` endpoint. Then drove the real browser end to end: navigated via the sidebar's "Admin" entry (not a direct URL), selected a role in the matrix and toggled a permission, confirmed a "Saved." message and — separately — confirmed via a follow-up API call that it actually persisted; filtered the audit log by action and confirmed the right rows appeared; searched for a guest, filed a new GDPR request through the form, and confirmed it appeared in the tracker with a real days-remaining count. 28/28 checks passed, zero console/page errors.

### Carried forward
"Custom role creator" and "preset role templates" (both named in the architecture map) are NOT built — no backend endpoint exists to create a new role, and none was added this pass. 9 of the 11 gaps remain; Property Config is next.
