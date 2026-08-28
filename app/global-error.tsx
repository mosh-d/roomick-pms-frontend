'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

/**
 * Next.js's own root-level error boundary — the one place forced to render
 * its own complete `<html>/<body>` rather than the app's usual RootLayout,
 * since this fires when RootLayout itself (or something it renders) has
 * thrown. `Sentry.captureException` is a documented safe no-op when Sentry
 * was never initialized (no DSN) — this file doesn't need its own gating.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col items-center justify-center gap-4 bg-white font-sans text-center px-6">
        <h1 className="text-2xl font-bold text-red-700">Something went wrong</h1>
        <p className="text-body text-gray-600 max-w-md">
          An unexpected error occurred. Please try reloading the page — if this keeps happening, contact support.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="font-semibold border border-gray-400 rounded px-4 py-2 hover:bg-gray-100 transition-colors cursor-pointer"
        >
          Reload
        </button>
      </body>
    </html>
  );
}
