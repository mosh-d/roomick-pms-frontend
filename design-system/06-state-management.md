# State management

## The split: server state vs. client state

Two different libraries, deliberately not one — they solve different
problems and conflating them is what makes Redux-only setups grow
boilerplate-heavy:

- **Server state — [TanStack Query](https://tanstack.com/query)**. Anything
  that ultimately comes from the NestJS backend (a room's status, a guest
  profile, a reservation) is server state: it can go stale, it's shared
  across users, and it needs caching/refetching/mutation semantics.
  `useQuery`/`useMutation` handle all of that — request de-duplication,
  background refetch, optimistic updates — instead of hand-rolling loading
  flags and cache invalidation in a reducer. Provider wiring lives in
  `app/providers.tsx`, wrapped around the whole app from `app/layout.tsx`.
- **Client/UI state — [Zustand](https://zustand.docs.pmnd.rs)**. Anything
  that's purely local to the browser session and never persisted server-side
  — a filter selection on the room grid, whether a side panel is open, the
  currently-active tenant/branch context after login. Zustand stores are
  plain functions with no provider/context wrapping required, and the API
  surface is small enough that a store is often under 20 lines.

**Rule of thumb:** if refetching it from the server would give a different
(more correct) answer, it's TanStack Query's job. If it only ever exists in
the browser tab, it's Zustand's.

## Why not Redux

Redux (or Redux Toolkit) can do both jobs, but doing so means either hand-
rolling the caching/refetching logic TanStack Query gives for free, or
bolting on RTK Query — at which point it's the same amount of code as
Query + Zustand, just under one roof. Given `00-brand-voice.md`'s "fast,
lightweight" mandate, less boilerplate for the same result is the win; Redux
DevTools' time-travel debugging is a real thing given up in this trade, but
nothing in this project's shape (no complex undo/redo, no cross-cutting
state machine) currently needs it.

## Setup

- `app/providers.tsx` — creates one `QueryClient` per component instance
  (via `useState`, not a module-level singleton — a module-level client
  would leak cached data across requests on the server) and wraps the app
  in `QueryClientProvider`.
- Zustand needs no provider. A store is just:
  ```ts
  import { create } from 'zustand';

  type UiStore = { sidebarOpen: boolean; setSidebarOpen: (v: boolean) => void };

  export const useUiStore = create<UiStore>((set) => ({
    sidebarOpen: true,
    setSidebarOpen: (v) => set({ sidebarOpen: v }),
  }));
  ```
  Two real stores exist now: `lib/store/authStore.ts` (the signed-in
  session — `accessToken`/`refreshToken`/`user`) and
  `lib/store/wizardStore.ts` (the entire onboarding wizard draft — every
  step's field values, which step you're on, and completion-tracking ids).
  Both use `zustand/middleware`'s `persist` (localStorage) — an addition to
  the plain example above, needed because both stores hold state that has
  to survive a page reload, not just move between components in one
  render tree. See `wizardStore.ts`'s and `authStore.ts`'s own header
  comments for the reasoning (including why the persisted session was a
  deliberate reversal of an earlier "never persist a token" decision).
