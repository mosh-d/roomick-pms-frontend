import * as Sentry from '@sentry/nextjs';

/** The configured share when it is a number from 0 to 1 — 0 turns tracing off — else the default. */
function sampleRate(configured: string | undefined): number {
  const rate = configured ? Number(configured) : NaN;
  return Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : process.env.NODE_ENV === 'production' ? 0.1 : 1.0;
}

/** Node runtime half of error tracking — loaded by `instrumentation.ts`. See `instrumentation-client.ts` for why the gating pattern is `if (dsn) init()` rather than trusting an empty DSN to no-op on its own. */
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    // Every request while testing; a tenth in production. `SENTRY_TRACES_SAMPLE_RATE` (0 to 1, 0 included) overrides. Errors are always captured.
    tracesSampleRate: sampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE),
  });
}
