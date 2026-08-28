import * as Sentry from '@sentry/nextjs';

/**
 * Error tracking (MVP timeline Month 6: "Sentry integration — frontend +
 * backend, separate DSNs"). Client-side half of the pair — see
 * `sentry.server.config.ts`/`sentry.edge.config.ts` for the other two
 * runtimes and `instrumentation.ts` for how they're loaded.
 *
 * `NEXT_PUBLIC_SENTRY_DSN`, not `SENTRY_DSN` — this file runs in the
 * browser, and Next.js only inlines `NEXT_PUBLIC_*` vars into client
 * bundles. Gated the same way the backend's own `src/instrument.ts` is:
 * unset means `Sentry.init()` never runs at all, a true no-op, not reliant
 * on the SDK's own empty-DSN handling.
 */
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 1.0,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
