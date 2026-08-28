import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
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

