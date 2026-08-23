/**
 * "king size bed" → "King Size Bed" — capitalizes the first letter after
 * the start of the string, any whitespace, or a hyphen (so "wi-fi" comes
 * out "Wi-Fi", not "Wi-fi"), lowercasing everything else first so
 * "KING SIZE" and "king size" both normalize to the same result rather
 * than the transform depending on however the input happened to be cased.
 * Used for free-text descriptive fields (Bed Type, custom Amenities/Views
 * tags) where two owners typing the same thing two different ways should
 * still read identically everywhere it's displayed later — not for names
 * (hotel/brand/branch names keep whatever capitalization was actually
 * typed, since forcing a stylized name like "iPhone Suite" into "Iphone
 * Suite" would be actively wrong).
 */
export function toTitleCase(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/(^|[\s-])([a-z])/g, (_match, separator: string, letter: string) => separator + letter.toUpperCase());
}
