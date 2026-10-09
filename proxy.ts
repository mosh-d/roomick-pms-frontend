import { NextResponse, type NextRequest } from 'next/server';

/**
 * Two jobs: forwarding the session routes to the API (below), and a Content
 * Security Policy with a fresh nonce on every page.
 *
 * The session itself is in an httpOnly cookie no script can read, but a
 * cross-site-scripting bug could still act as whoever is signed in while the
 * page is open. The policy used to allow
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
 * - Images: this app, blobs and data URIs (camera captures, logo previews),
 *   any https host — room-type photos can be pasted links — and the API,
 *   which serves the photos uploaded to the property's own storage.
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
    `img-src 'self' blob: data: https: ${apiOrigin}`,
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

/** Where the API is; the session routes are forwarded there. */
const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3000/api/v1').replace(/\/+$/, '');

/**
 * The routes that start, renew and end a session (`SESSION_BASE_URL` in
 * lib/api.ts) come to this site's own address and go on to the API from
 * here, so the session cookie the API sets is this site's own. Two headers
 * go with them: who the visitor is — the API would otherwise see this
 * server, and count every sign-in in the country against one address — and
 * WEB_PROXY_SECRET, the value both services share, which is the only reason
 * the API believes the first. A visitor's own copies of either are dropped.
 */
function forwardSessionRoute(request: NextRequest): NextResponse {
  let target: URL;
  try {
    target = new URL(`${apiBase}${request.nextUrl.pathname.slice('/api/v1'.length)}${request.nextUrl.search}`);
  } catch {
    return NextResponse.json({ title: 'The API address is not set up', detail: 'NEXT_PUBLIC_API_URL must be the API’s full address.' }, { status: 502 });
  }
  const headers = new Headers(request.headers);
  headers.delete('x-roomick-proxy-secret');
  headers.delete('x-roomick-visitor-ip');
  const secret = process.env.WEB_PROXY_SECRET;
  const visitor = request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (secret && visitor) {
    headers.set('x-roomick-proxy-secret', secret);
    headers.set('x-roomick-visitor-ip', visitor);
  }
  return NextResponse.rewrite(target, { request: { headers } });
}

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/v1/auth/')) return forwardSessionRoute(request);

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
