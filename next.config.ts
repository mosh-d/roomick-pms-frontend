import type { NextConfig } from 'next';

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

export default nextConfig;

