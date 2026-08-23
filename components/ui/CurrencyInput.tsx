'use client';

import { useState } from 'react';
import { Input, type InputProps } from './Input';
import { formatWithCommas, displayWithCommas } from '@/lib/numberFormat';

type CurrencyInputProps = Omit<InputProps, 'type' | 'value' | 'onChange'> & {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
};

/**
 * A rate/price field with live thousands-separator formatting (`30000` →
 * `30,000` as it's typed) — wraps `Input`, doesn't duplicate its anatomy.
 * Native `<input type="number">` can't show this at all (the browser
 * strips non-digit characters, commas included), so this renders a plain
 * text field with a numeric keyboard hint (`inputMode="decimal"`) instead,
 * same trade-off `RegisterForm`'s phone field already made for the same
 * reason.
 *
 * Own local `display` state (not derived fresh from `value` every render)
 * for the same reason `lib/phone.ts`'s live formatting needs it: reformatting
 * straight from the clean numeric `value` on every render would silently
 * eat a trailing "30000." the moment the owner types the decimal point,
 * before there's a digit after it to keep `value` meaningfully different.
 */
export function CurrencyInput({ value, onChange, ...rest }: CurrencyInputProps) {
  const [display, setDisplay] = useState(() => displayWithCommas(value));

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={display}
      onChange={(event) => {
        const result = formatWithCommas(event.target.value);
        setDisplay(result.display);
        onChange(result.value);
      }}
      {...rest}
    />
  );
}
