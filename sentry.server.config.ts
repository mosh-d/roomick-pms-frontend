import * as Sentry from '@sentry/nextjs';

/** Node runtime half of error tracking — loaded by `instrumentation.ts`. See `instrumentation-client.ts` for why the gating pattern is `if (dsn) init()` rather than trusting an empty DSN to no-op on its own. */
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 1.0,
  });
}
