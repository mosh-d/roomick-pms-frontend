'use client';

import { useState } from 'react';
import { copyToClipboard } from '@/lib/clipboard';
import { Button } from './Button';

/** Copies a link or code to the clipboard, saying so for two seconds — or saying it couldn't. */
export function CopyButton({ value, label = 'Copy', id }: { value: string; label?: string; id?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  return (
    <Button
      id={id}
      type="button"
      size="sm"
      variant="outline"
      onClick={async () => {
        setState((await copyToClipboard(value)) ? 'copied' : 'failed');
        setTimeout(() => setState('idle'), 2000);
      }}
    >
      {state === 'copied' ? 'Copied!' : state === 'failed' ? 'Select and copy it' : label}
    </Button>
  );
}
