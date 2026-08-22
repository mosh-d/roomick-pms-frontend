/**
 * JS-context mirror of tokens.css — for the rare place a component needs a
 * raw hex string rather than a Tailwind utility class (e.g. a `<meta
 * name="theme-color">` tag, or a canvas/chart library that can't consume
 * CSS custom properties).
 *
 * MUST be kept in sync with tokens.css BY HAND. There are only ~20 values
 * here, so this is a deliberate trade-off (Daddy Bear's own tokens.ts states
 * the same caveat) rather than reaching for a codegen step neither project
 * needs yet.
 */

export const colors = {
  // Brand palette — the 8 given tokens.
  primary: '#CCA000',
  primaryDark: '#2E2400',
  primaryLight: '#FFF0B9',
  secondary: '#160029',
  secondaryLight: '#A698B2',
  accent: '#A1ABB2',
  accentDark: '#3B444A',

  // Accessibility extension — see tokens.css for the contrast math.
  primaryText: '#8C6D00',

  // Status extension — see tokens.css / status-tags.md for the reasoning.
  statusVacant: '#3F8F5C',
  statusOccupied: '#2E7D8C',
  statusCleaning: '#6B4A8A',
  statusOutOfOrder: '#9A5A2E',
  statusBlocked: '#3B444A', // == accentDark
  statusDirty: '#9A5A2E', // == statusOutOfOrder
  statusClean: '#2E7D8C', // == statusOccupied
  statusInspected: '#3F8F5C', // == statusVacant
} as const;

export const fonts = {
  body: "'Satoshi', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  display: "'Playfair Display', ui-serif, Georgia, 'Times New Roman', serif",
} as const;
