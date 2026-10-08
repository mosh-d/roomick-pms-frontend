import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const isDev = process.env.NODE_ENV !== 'production';

/** The API's origin, for `connect-src` — the same value `lib/api.ts` calls. */
const apiOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3000/api/v1').origin;
  } catch {
    return '';
  }
})();

/**
 * Content Security Policy. Sessions live in localStorage, so a single
 * cross-site-scripting bug anywhere would hand a session to whoever found
 * it — this is the backstop that keeps an injected script from running or
 * phoning out. Next.js's own bootstrap is an inline script, so inline
 * scripts stay allowed (a nonce would need a middleware on every page);
 * development also needs eval and a WebSocket for hot reloading.
 *
 * - Scripts, styles and fonts come from this app only (next/font self-hosts).
 * - Images: this app, blobs and data URIs (camera captures, logo previews)
 *   and any https host — room-type photos are pasted links.
 * - Connections: this app, the API, and Sentry when a DSN is set.
 * - Frames: only the email preview, a sandboxed `srcDoc` frame; nothing may
 *   frame this app.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
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

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // The camera is for ID capture at check-in; nothing here needs the rest.
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },

  // Pin the Turbopack workspace root to this project. Without it, Next.js
  // walks up looking for a workspace root and finds an unrelated
  // package-lock.json under the Windows user profile folder (this project
  // sits inside a multi-project parent, `5 CLOVER/WEB/`) — harmless, but
  // produces a noisy warning on every build. Same fix the sibling Daddy
  // Bear frontend uses for the same reason.
  turbopack: {
    root: __dirname,
  },

  // `/` IS the dashboard. It used to render a scaffold placeholder whose
  // whole job was to link to `/style-guide` — copy that had gone stale
  // ("Real application pages haven't been built yet") long before the
  // dashboard shipped. That page is deleted; this redirect replaces it.
  //
  // Done here rather than as an `app/page.tsx` calling `redirect()` because
  // this is a URL-structure change, which is what `redirects` is for: it
  // resolves before any render and covers prefetches too, instead of
  // shipping a route whose only purpose is to bounce.
  //
  // `permanent: false` (307), deliberately, NOT 308. A permanent redirect
  // gets cached hard by browsers, and `/` on an app shell is exactly the
  // route most likely to become something else later (a marketing splash, a
  // tenant picker). A cached 308 would make that change invisible to anyone
  // who had already hit the old one.
  //
  // Unauthenticated visitors take two hops — `/` → `/dashboard` → `/login`,
  // the second from `DashboardLayout`'s own auth gate. That gate stays the
  // single place auth is decided; duplicating it here would give us two.
  async redirects() {
    return [{ source: '/', destination: '/dashboard', permanent: false }];
  },
};

// Only wraps the config (and only then invokes the Sentry build plugin at
// all) when a DSN is actually configured — an unconfigured build must never
// even ask Sentry's webpack/turbopack plugin to run, since `org`/`project`
// aren't set either and there's nothing for it to do. `SENTRY_ORG`/
// `SENTRY_PROJECT` are only needed here for source-map upload, which itself
// only runs with a real auth token in CI — neither is required to boot or
// build without one.
export default process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: !process.env.CI,
    })
  : nextConfig;

