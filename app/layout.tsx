import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import { satoshi, playfairDisplay } from '@/lib/fonts';
import { colors } from '@/design-system/tokens';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: {
    default: 'Roomick PMS',
    template: '%s — Roomick PMS',
  },
  description: 'Roomick — a fast, lightweight, mobile-friendly hotel property management system.',
};

export const viewport = {
  themeColor: colors.secondary,
};

// Next.js 16's RootLayout signature is `LayoutProps<'/'>` (a typed-route
// helper), not the older `{ children }: { children: ReactNode }` — see
// AGENTS.md at the project root and node_modules/next/dist/docs/.
export default async function RootLayout({ children }: LayoutProps<'/'>) {
  // Every page is rendered per request: `proxy.ts` gives each one its own
  // script nonce, and a page prerendered at build time would carry a stale
  // one that no live policy matches. Reading the headers is what makes the
  // whole tree dynamic.
  await headers();
  return (
    // Both font `.variable` classNames go on <html> so their CSS custom
    // properties (--font-body / --font-display) are in scope everywhere.
    // They shadow the static fallback stacks declared in
    // design-system/tokens.css once the fonts load — see lib/fonts.ts.
    //
    // suppressHydrationWarning: browser extensions (password managers,
    // "installed" markers, etc.) inject their own attributes onto <html>
    // before React hydrates — e.g. `data-qb-installed`, never anything
    // this app renders. That's a real, sanctioned reason to suppress here
    // (see node_modules/next/dist/docs's "Preventing Flash" guide), not a
    // blanket "hide hydration bugs" — it only silences *attribute*
    // mismatches on this one element, not children or genuine app bugs.
    <html lang="en" className={`${satoshi.variable} ${playfairDisplay.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-white font-body text-body text-surface antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
