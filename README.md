# Roomick PMS — Frontend

A fast, lightweight, mobile-friendly hotel Property Management System frontend. Next.js (App Router) + TypeScript + Tailwind v4, talking to the separate `roomick-pms-backend` (NestJS + Prisma + PostgreSQL).

**Before building or changing anything, check `Roomick PMS/references/`** (one level up from this repo) — `Roomick-UI.pdf` (the UI reference, 35 pages), `pms-frontend-structure-2.html` (full route/API contract across every module), `pms-database-architecture-3.html`, `pms-mvp-timeline.html`. This project has repeatedly needed rework when a component was built from assumption or a cropped screenshot instead of the actual reference — see `PHASE_NOTES.md` for specifics.

## Getting started

```bash
npm install
npm run dev -- -p 3001      # http://localhost:3001
```

**Runs on 3001, not Next.js's default 3000** — the backend owns port 3000 (its own documented default, and what its `CORS_ORIGINS` env var already allowlists is `http://localhost:3001`). Running both on their default ports collides; this cost real time to work out once, so it's written down here now.

No other `.env` is required yet — nothing calls the backend live as of this writing (see `PHASE_NOTES.md`). Once API integration starts, this section will document the required `NEXT_PUBLIC_API_URL` and any other env vars.

## What's here

- **`design-system/`** — tokens (`tokens.css`/`tokens.ts`) and component-level docs (color, typography, spacing, buttons, forms, cards, status tags, layout patterns, state management). Read these before touching a component in `components/ui/`.
- **`components/ui/`** — the hand-rolled component library (Button, Card, Input, Select, RadioCard, Section, EntryCard, FeatureCard, etc.), all grounded in the actual product reference — see each file's own header comment for the specific reasoning.
- **`app/style-guide/`** — the live, working reference for every component/token/state (`/style-guide` route). The primary way this project's UI work gets verified — screenshotted and interacted with, not just read as code.
- **`PHASE_NOTES.md`** — application-level build log (what's been built, in what order, and why) — the frontend's equivalent of the backend's own `PHASE_NOTES.md`. Component-level decisions live in `design-system/` instead; this file is for everything above that (pages, routing, API integration, cross-cutting architecture).

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 (CSS-first `@theme`, no `tailwind.config.ts`) · React Hook Form + Zod · TanStack Query (server state) · Zustand (client state) — see `design-system/06-state-management.md` for the server/client split rationale.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | watch mode (Turbopack) |
| `npm run build` | production build |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | type-check |

## Backend

`roomick-pms-backend` (sibling repo) — NestJS + Prisma + PostgreSQL, multi-tenant with row-level security. See its own `README.md`/`PHASE_NOTES.md`/`backend-execution-spec.md` for how it works. Its API contract is documented in `Roomick PMS/references/pms-frontend-structure-2.html` — that doc and the backend's actual code can disagree in places (the backend is the source of truth when they do — see this frontend's own `PHASE_NOTES.md` for a caught example).
