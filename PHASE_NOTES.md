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
  validates the moment it loses focus.
- `RegisterForm`'s Owner Account step now matches the reference field-for-
  field where the backend allows: First Name + Last Name (not one "Full
  Name" field) — joined into the single `name` string `RegisterDto`
  actually wants right before the API call, so the DTO itself didn't need
  to change.

### Decisions & deviations
1. **`Country` (shown on the reference's Owner Account Form) is not built.**
   `RegisterDto` has no matching field at all — a fourth reference/backend
   mismatch, same shape as the three already documented in Phases 2–3.
   Worse than the others: the global `ValidationPipe`'s
   `forbidNonWhitelisted: true` means sending an undeclared field doesn't
   get silently dropped, it fails the whole request. Building a UI control
   with nowhere real to send its value would be a half-finished
   implementation, not a shortcut — omitted until the backend has a field
   for it (a small, real addition if wanted: flag it rather than assume).
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
- Real building/floor/multi-branch UI — same "Full onboarding mode" item
  from Phase 3, now additionally confirmed to need matching sidebar nesting
  if it's ever built.
- Verify the autofill fix against a real Chrome profile, not just headless
  Playwright.
