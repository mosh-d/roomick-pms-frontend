import * as Sentry from '@sentry/nextjs';

/** The configured share when it is a number from 0 to 1 — 0 turns tracing off — else the default. */
function sampleRate(configured: string | undefined): number {
  const rate = configured ? Number(configured) : NaN;
  return Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : process.env.NODE_ENV === 'production' ? 0.1 : 1.0;
}

/** Edge runtime half of error tracking (middleware, edge routes — this app has neither today, but Next.js still probes for this file). Loaded by `instrumentation.ts`. See `instrumentation-client.ts` for the gating rationale. */
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    // Every request while testing; a tenth in production. `SENTRY_TRACES_SAMPLE_RATE` (0 to 1, 0 included) overrides. Errors are always captured.
    tracesSampleRate: sampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE),
  });
}
