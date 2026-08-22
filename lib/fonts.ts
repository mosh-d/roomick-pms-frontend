import localFont from 'next/font/local';
import { Playfair_Display } from 'next/font/google';

/**
 * Satoshi isn't on Google Fonts (it's distributed by Fontshare), so it can't
 * use next/font/google's automatic self-hosting. Instead we fetched the real
 * static woff2 files (licensed for self-hosting under Fontshare's Free Font
 * License — see public/fonts/satoshi/) and wire them up manually via
 * next/font/local, which gives the same benefits next/font/google would:
 * self-hosted, no external network request, no layout shift.
 *
 * Only Regular (400) and Bold (700) are included — the type scale never
 * calls for a third weight, and shipping fewer font files is a direct win
 * for "fast, lightweight" (the whole point of choosing static per-weight
 * files over the variable font, which would need extra
 * font-variation-settings wiring for no benefit here).
 *
 * `src` paths are resolved relative to *this file*, not the project root.
 */
export const satoshi = localFont({
  src: [
    { path: '../public/fonts/satoshi/Satoshi-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../public/fonts/satoshi/Satoshi-Bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-body',
  display: 'swap',
});

/** Playfair Display IS on Google Fonts — next/font/google self-hosts it for us automatically. */
export const playfairDisplay = Playfair_Display({
  variable: '--font-display',
  subsets: ['latin'],
});
