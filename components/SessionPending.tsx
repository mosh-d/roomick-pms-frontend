'use client';

import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/lib/store/authStore';

/**
 * A page just loaded by someone signed in, while it gets an access token
 * back from the session cookie — or, when Roomick can't be reached, a way to
 * try again. They're still signed in either way: a dropped connection
 * doesn't cost anyone their session.
 */
export function SessionPending({ failed }: { failed: boolean }) {
  const restoreSession = useAuthStore((s) => s.restoreSession);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      {failed ? (
        <>
          <p className="text-body text-surface">Roomick can’t be reached right now. Check the internet connection, then try again.</p>
          <Button onClick={() => void restoreSession()}>Try again</Button>
        </>
      ) : (
        <p className="text-body text-surface-muted">Signing you back in…</p>
      )}
    </div>
  );
}
