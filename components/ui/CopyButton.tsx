'use client';

import { useState } from 'react';
import { Button } from './Button';

/** Copies a link or code to the clipboard, saying so for two seconds. */
export function CopyButton({ value, label = 'Copy', id }: { value: string; label?: string; id?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      id={id}
      type="button"
      size="sm"
      variant="outline"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? 'Copied!' : label}
    </Button>
  );
}
