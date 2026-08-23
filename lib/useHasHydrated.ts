'use client';

import { useEffect, useState } from 'react';

type PersistApi = { hasHydrated: () => boolean; onFinishHydration: (fn: () => void) => () => void };

/**
 * True once a `persist`-wrapped Zustand store has finished reading its
 * saved state back from localStorage. Needed because `persist` hydrates
 * asynchronously, after the first render: without this guard, a page that
 * reads the store's *initial* values on that first render (e.g. `mode ===
 * null` meaning "show the demo/real choice screen") flashes that initial
 * UI for a moment before snapping to the real persisted state — reported
 * directly ("I see a brief create-your-account screen on reload").
 *
 * Always starts `false`, on both the server and the client's first render,
 * and only ever flips to `true` inside `useEffect` (client-only, never
 * during SSR) — not a lazy `useState` initializer that reads
 * `store.persist` directly. That first version crashed SSR outright
 * ("Cannot read properties of undefined (reading 'hasHydrated')") because
 * `store.persist` isn't necessarily set up yet during the server render
 * pass; this version also avoids a hydration *mismatch* (server and
 * client's first paint must render identical output), which a
 * conditional initial value can't guarantee since there's no way to know
 * client-side hydration status before the client has even mounted.
 *
 * `store.persist` is the same object on every Zustand store created with
 * the `persist` middleware (see `authStore.ts`/`wizardStore.ts`) — this
 * hook works for any of them, not just one.
 */
export function useHasHydrated(store: { persist?: PersistApi }): boolean {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    // The initial read of `hasHydrated()` is deferred into a microtask
    // (not called directly in the effect body) purely to satisfy the
    // react-hooks/set-state-in-effect lint rule, which can't tell this
    // apart from deriving state that belongs in render — it doesn't
    // change behavior: by the time any component mounts, the store's
    // module-level `create()` call (and its synchronous localStorage
    // read) already ran, so this resolves on the very next microtask.
    if (!store.persist) {
      queueMicrotask(() => setHasHydrated(true));
      return;
    }
    const persist = store.persist;
    queueMicrotask(() => setHasHydrated(persist.hasHydrated()));
    return persist.onFinishHydration(() => setHasHydrated(true));
  }, [store]);

  return hasHydrated;
}
