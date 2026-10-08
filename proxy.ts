import { NextResponse, type NextRequest } from 'next/server';

/**
 * A Content Security Policy with a fresh nonce on every page.
 *
 * Sessions live in localStorage, so a single cross-site-scripting bug would
 * hand a session to whoever found it. The policy used to allow
 * `'unsafe-inline'` scripts — which lets exactly the injected inline script
 * an XSS plants run, so it protected against nothing that mattered. With a
 * nonce only the scripts this app rendered can run: Next.js reads the nonce
 * from the `x-nonce` request header and stamps it on every script tag it
 * emits, and `'strict-dynamic'` lets those scripts load the chunks they need.
 *
 * Runs as Next.js's proxy (what used to be called middleware) so each request
 * gets its own nonce; the page itself is rendered per request for the same
 * reason (see `app/layout.tsx`).
 *
 * - Scripts: this app's own, by nonce (plus eval and a WebSocket for hot
 *   reloading in development).
 * - Styles: this app and inline `style` attributes (React sets widths and
 *   colours inline; styles can't carry a script).
 * - Images: this app, blobs and data URIs (camera captures, logo previews)
 *   and any https host — room-type photos are pasted links.
 * - Connections: this app, the API, and Sentry when a DSN is set.
 * - Frames: only the email preview, a sandboxed `srcDoc` frame; nothing may
 *   frame this app.
 */
const isDev = process.env.NODE_ENV !== 'production';

const apiOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3000/api/v1').origin;
  } catch {
    return '';
  }
})();

function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${apiOrigin} https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io${isDev ? ' ws://localhost:* ws://127.0.0.1:*' : ''}`,
    "frame-src 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ]
    .join('; ')
    .replace(/\s+/g, ' ');
}

export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Every page, but not the static assets, and not the router's own prefetches.
      source: '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
