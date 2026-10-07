'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { LockIcon } from '@/components/ui/Icons';

/**
 * Shown when the session has ended for good mid-work — an hour with no one
 * at the screen, or renewal refused. One way out, on purpose: no close
 * button, no backdrop click, no Escape, since dismissing it would leave a
 * page whose every button now fails. It says plainly that unsaved work
 * needs redoing, because nothing on the page can be saved any more. (The
 * Five Clover PMS's own prompt, word for word in spirit.)
 */
export function SessionEndedPrompt({ onSignIn }: { onSignIn: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const button = () => dialogRef.current?.querySelector<HTMLButtonElement>('button');
    button()?.focus();
    // Dialogs underneath listen for Escape; closing them changes nothing about being signed out.
    function swallow(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
      }
      // Focus stays on the one way out.
      if (event.key === 'Tab') {
        event.preventDefault();
        button()?.focus();
      }
    }
    document.addEventListener('keydown', swallow, true);
    return () => document.removeEventListener('keydown', swallow, true);
  }, []);

  return (
    <div
      ref={dialogRef}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="session-ended-title"
      aria-describedby="session-ended-body"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-card bg-white p-8 text-center shadow-xl">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary-light/40 text-primary-dark">
          <LockIcon className="size-7" />
        </span>
        <h2 id="session-ended-title" className="font-display text-header font-bold text-primary-dark">
          Your session has ended
        </h2>
        <p id="session-ended-body" className="text-body text-primary-dark/75">
          You&apos;ve been signed out after an hour away, so nothing on this page can be saved until you sign in again. Anything you had typed and not yet
          saved will need to be entered again.
        </p>
        <Button type="button" onClick={onSignIn}>
          Sign in again
        </Button>
      </div>
    </div>
  );
}
