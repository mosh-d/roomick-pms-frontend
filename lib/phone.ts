import { AsYouType, getCountryCallingCode, isSupportedCountry, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

/**
 * Reuses whatever the owner already picked in the (separate) Country field
 * — no second "phone country" picker — to show a calling-code prefix
 * (`+234`) and drive `AsYouType`'s national-format grouping. `null` until a
 * supported country is actually selected.
 */
export function callingCodeFor(country: string | null | undefined): string | null {
  if (country && isSupportedCountry(country)) {
    return `+${getCountryCallingCode(country as CountryCode)}`;
  }
  return null;
}

/**
 * Re-derives formatting from scratch on every keystroke (strip to raw
 * digits, re-run through a fresh `AsYouType`) rather than trying to patch
 * an already-formatted string — the standard technique, and the only one
 * that's robust to the user editing in the middle of a formatted value
 * (deleting a space, pasting, etc.) without the cursor/grouping going out
 * of sync with itself.
 *
 * Deliberately formats via the *international* template
 * (`+<callingCode><digits>`), then strips the `+<callingCode>` prefix back
 * off before returning `display` — not `AsYouType(country).input(digits)`
 * on its own. Several countries' *national* grouping template (Nigeria
 * included) only activates once a leading trunk "0" is typed; since the
 * calling code is already shown as its own badge (not typed), feeding bare
 * national digits into the national template often comes back completely
 * ungrouped. The international template groups consistently without that
 * trunk digit, which is exactly the shape a "digits after a fixed +234
 * badge" field needs. A leading trunk "0" is still tolerated if a user
 * types one out of habit — stripped before formatting, since the calling
 * code already replaces it.
 *
 * Returns both what to show and the canonical E.164 string that's actually
 * validated/stored/sent to the backend (`RegisterDto.phone`,
 * `@MaxLength(20)` — E.164 is at most 16 characters, always comfortably
 * under that, regardless of which country's grouping is display-only).
 */
export function formatPhoneAsYouType(
  typed: string,
  country: string | null | undefined,
): { display: string; e164: string } {
  const cc = country && isSupportedCountry(country) ? (country as CountryCode) : undefined;
  const callingCode = cc ? getCountryCallingCode(cc) : null;

  if (!callingCode) {
    const digits = typed.replace(/[^\d+]/g, '');
    const formatter = new AsYouType();
    const display = formatter.input(digits);
    return { display, e164: formatter.getNumber()?.number ?? digits };
  }

  const digits = typed.replace(/[^\d]/g, '').replace(/^0+/, '');
  const formatter = new AsYouType();
  const full = formatter.input(`+${callingCode}${digits}`);
  const prefix = `+${callingCode}`;
  const display = full.startsWith(prefix) ? full.slice(prefix.length).trimStart() : full;
  return { display, e164: formatter.getNumber()?.number ?? `+${callingCode}${digits}` };
}

/** Read-only display (Review, AlreadyRegistered) — formats an already-stored E.164 value; falls back to the raw string if it doesn't parse (e.g. was saved before this formatting existed). */
export function formatPhoneDisplay(e164: string): string {
  const parsed = parsePhoneNumberFromString(e164);
  return parsed ? parsed.formatInternational() : e164;
}

/**
 * Reformats an already-canonical E.164 value (e.g. resuming a saved
 * `registerDraft`) back into the same "digits after the badge" display
 * `formatPhoneAsYouType` produces while typing. Not the same as just
 * re-running `formatPhoneAsYouType(e164, country)` directly — the E.164
 * string's digits already include the calling code baked in, so it has to
 * go through `parsePhoneNumberFromString` first to recover just the
 * national significant number before re-grouping it.
 */
export function displayFromE164(e164: string, country: string | null | undefined): string {
  const parsed = parsePhoneNumberFromString(e164);
  const nationalDigits = parsed ? parsed.nationalNumber : e164.replace(/[^\d]/g, '');
  return formatPhoneAsYouType(nationalDigits, country).display;
}
