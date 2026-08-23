/**
 * One ISO 4217 currency code per `lib/countries.ts` entry — the official
 * legal-tender currency for each country (eurozone members all map to
 * `EUR`, not a pre-euro legacy code). Unlike `lib/timezones.ts`'s
 * one-per-multi-zone-country compromise, this is authoritative for nearly
 * every country here — very few have more than one official currency, so
 * there's no real accuracy trade-off being made by not showing a field for
 * this at all (see `BranchSetupForm`'s header comment on why Currency and
 * Timezone are both derived from Country silently, with no separate UI).
 */
export const DEFAULT_CURRENCY_BY_COUNTRY: Record<string, string> = {
  AF: 'AFN',
  AL: 'ALL',
  DZ: 'DZD',
  AD: 'EUR',
  AO: 'AOA',
  AG: 'XCD',
  AR: 'ARS',
  AM: 'AMD',
  AU: 'AUD',
  AT: 'EUR',
  AZ: 'AZN',
  BS: 'BSD',
  BH: 'BHD',
  BD: 'BDT',
  BB: 'BBD',
  BY: 'BYN',
  BE: 'EUR',
  BZ: 'BZD',
  BJ: 'XOF',
  BT: 'BTN',
  BO: 'BOB',
  BA: 'BAM',
  BW: 'BWP',
  BR: 'BRL',
  BN: 'BND',
  BG: 'BGN',
  BF: 'XOF',
  BI: 'BIF',
  CV: 'CVE',
  KH: 'KHR',
  CM: 'XAF',
  CA: 'CAD',
  CF: 'XAF',
  TD: 'XAF',
  CL: 'CLP',
  CN: 'CNY',
  CO: 'COP',
  KM: 'KMF',
  CG: 'XAF',
  CD: 'CDF',
  CR: 'CRC',
  CI: 'XOF',
  HR: 'EUR',
  CU: 'CUP',
  CY: 'EUR',
  CZ: 'CZK',
  DK: 'DKK',
  DJ: 'DJF',
  DM: 'XCD',
  DO: 'DOP',
  EC: 'USD',
  EG: 'EGP',
  SV: 'USD',
  GQ: 'XAF',
  ER: 'ERN',
  EE: 'EUR',
  SZ: 'SZL',
  ET: 'ETB',
  FJ: 'FJD',
  FI: 'EUR',
  FR: 'EUR',
  GA: 'XAF',
  GM: 'GMD',
  GE: 'GEL',
  DE: 'EUR',
  GH: 'GHS',
  GR: 'EUR',
  GD: 'XCD',
  GT: 'GTQ',
  GN: 'GNF',
  GW: 'XOF',
  GY: 'GYD',
  HT: 'HTG',
  HN: 'HNL',
  HU: 'HUF',
  IS: 'ISK',
  IN: 'INR',
  ID: 'IDR',
  IR: 'IRR',
  IQ: 'IQD',
  IE: 'EUR',
  IL: 'ILS',
  IT: 'EUR',
  JM: 'JMD',
  JP: 'JPY',
  JO: 'JOD',
  KZ: 'KZT',
  KE: 'KES',
  KI: 'AUD',
  KW: 'KWD',
  KG: 'KGS',
  LA: 'LAK',
  LV: 'EUR',
  LB: 'LBP',
  LS: 'LSL',
  LR: 'LRD',
  LY: 'LYD',
  LI: 'CHF',
  LT: 'EUR',
  LU: 'EUR',
  MG: 'MGA',
  MW: 'MWK',
  MY: 'MYR',
  MV: 'MVR',
  ML: 'XOF',
  MT: 'EUR',
  MR: 'MRU',
  MU: 'MUR',
  MX: 'MXN',
  MD: 'MDL',
  MC: 'EUR',
  MN: 'MNT',
  ME: 'EUR',
  MA: 'MAD',
  MZ: 'MZN',
  MM: 'MMK',
  NA: 'NAD',
  NR: 'AUD',
  NP: 'NPR',
  NL: 'EUR',
  NZ: 'NZD',
  NI: 'NIO',
  NE: 'XOF',
  NG: 'NGN',
  KP: 'KPW',
  MK: 'MKD',
  NO: 'NOK',
  OM: 'OMR',
  PK: 'PKR',
  PW: 'USD',
  PA: 'PAB',
  PG: 'PGK',
  PY: 'PYG',
  PE: 'PEN',
  PH: 'PHP',
  PL: 'PLN',
  PT: 'EUR',
  QA: 'QAR',
  RO: 'RON',
  RU: 'RUB',
  RW: 'RWF',
  KN: 'XCD',
  LC: 'XCD',
  VC: 'XCD',
  WS: 'WST',
  SM: 'EUR',
  ST: 'STN',
  SA: 'SAR',
  SN: 'XOF',
  RS: 'RSD',
  SC: 'SCR',
  SL: 'SLE',
  SG: 'SGD',
  SK: 'EUR',
  SI: 'EUR',
  SB: 'SBD',
  SO: 'SOS',
  ZA: 'ZAR',
  KR: 'KRW',
  SS: 'SSP',
  ES: 'EUR',
  LK: 'LKR',
  SD: 'SDG',
  SR: 'SRD',
  SE: 'SEK',
  CH: 'CHF',
  SY: 'SYP',
  TW: 'TWD',
  TJ: 'TJS',
  TZ: 'TZS',
  TH: 'THB',
  TL: 'USD',
  TG: 'XOF',
  TO: 'TOP',
  TT: 'TTD',
  TN: 'TND',
  TR: 'TRY',
  TM: 'TMT',
  TV: 'AUD',
  UG: 'UGX',
  UA: 'UAH',
  AE: 'AED',
  GB: 'GBP',
  US: 'USD',
  UY: 'UYU',
  UZ: 'UZS',
  VU: 'VUV',
  VA: 'EUR',
  VE: 'VES',
  VN: 'VND',
  YE: 'YER',
  ZM: 'ZMW',
  ZW: 'ZWL',
};

export function defaultCurrencyFor(country: string | null | undefined): string | null {
  if (!country) return null;
  return DEFAULT_CURRENCY_BY_COUNTRY[country] ?? null;
}

// Reverse of DEFAULT_CURRENCY_BY_COUNTRY (currency -> its first matching
// country), built once and cached rather than a second hand-authored table.
// Exists purely so currencySymbolFor can ask Intl for a *region-qualified*
// locale ('en-NG', not plain 'en') — real, verified difference: plain 'en'
// resolves NGN/KES/GHS/ZAR/PKR to their bare ISO code, while 'en-NG',
// 'en-KE', 'en-GH', 'en-ZA', 'en-PK' correctly resolve to ₦/Ksh/GH₵/R/Rs.
// ICU's currency-symbol data is keyed by region for a lot of non-Western
// currencies, not just language, so "English" alone isn't enough context.
let currencyToCountry: Record<string, string> | null = null;
function countryForCurrency(currency: string): string | undefined {
  if (!currencyToCountry) {
    currencyToCountry = {};
    for (const [country, code] of Object.entries(DEFAULT_CURRENCY_BY_COUNTRY)) {
      if (!(code in currencyToCountry)) currencyToCountry[code] = country;
    }
  }
  return currencyToCountry[currency];
}

/**
 * The actual glyph for a currency code (`NGN` → `₦`, `USD` → `$`, ...) —
 * via `Intl.NumberFormat`, not a second hand-authored ~190-row table.
 * Locale is `en-{country}` (via `countryForCurrency` above) when a country
 * is known for this currency, not plain `en` — verified directly: `Intl`
 * only resolves several real currency symbols (NGN, KES, GHS, ZAR, PKR,
 * ...) under a region-qualified locale, falling back to the bare ISO code
 * under plain `en` even though the symbol genuinely exists. Some
 * currencies still have no distinct glyph at all even region-qualified
 * (e.g. EGP, THB, BDT) — that's the platform's own answer for "what does
 * this currency look like", not a gap in this function. Falls back to the
 * raw code if `currency` isn't a real ISO 4217 value `Intl` recognizes
 * (e.g. still empty, mid-typing).
 */
export function currencySymbolFor(currency: string | null | undefined): string {
  if (!currency) return '';
  const locale = countryForCurrency(currency);
  try {
    const parts = new Intl.NumberFormat(locale ? `en-${locale}` : 'en', { style: 'currency', currency, currencyDisplay: 'symbol' }).formatToParts(0);
    return parts.find((part) => part.type === 'currency')?.value ?? currency;
  } catch {
    return currency;
  }
}
