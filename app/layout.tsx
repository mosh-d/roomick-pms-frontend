import type { Metadata } from 'next';
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
export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // Both font `.variable` classNames go on <html> so their CSS custom
    // properties (--font-body / --font-display) are in scope everywhere.
    // They shadow the static fallback stacks declared in
    // design-system/tokens.css once the fonts load — see lib/fonts.ts.
    <html lang="en" className={`${satoshi.variable} ${playfairDisplay.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-white font-body text-body text-secondary antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
