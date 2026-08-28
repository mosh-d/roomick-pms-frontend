import * as Sentry from '@sentry/nextjs';

/** Next.js's own instrumentation hook — loads the right Sentry config for whichever runtime this process actually is. Both imported files are themselves DSN-gated no-ops when Sentry isn't configured (see their own comments), so this file has nothing to gate on its own. */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
