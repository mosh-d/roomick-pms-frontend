import * as Sentry from '@sentry/nextjs';

/** Edge runtime half of error tracking (middleware, edge routes — this app has neither today, but Next.js still probes for this file). Loaded by `instrumentation.ts`. See `instrumentation-client.ts` for the gating rationale. */
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 1.0,
  });
}
