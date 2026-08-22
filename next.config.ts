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
};

export default nextConfig;

