'use client';

import { useRouter } from 'next/navigation';
import { ArrowRightIcon } from './Icons';

/**
 * `BackButton`'s companion — same "drilled into" detail pages, so undoing
 * a Back press (or replaying forward through a multi-step flow the agent
 * just stepped back out of) doesn't depend on the browser chrome's own
 * forward button, which is easy to miss or not have visible at all
 * (maximized kiosk-style front-desk displays often hide it). `router.
 * forward()` is a harmless no-op with nothing to go forward to — same
 * behavior a real browser's own forward button has when it's greyed out,
 * just without the visual disabling, since there's no reliable
 * cross-browser way to detect forward-history availability up front.
 */
export function ForwardButton({ label = 'Forward' }: { label?: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.forward()}
      className="inline-flex w-fit items-center gap-1.5 text-small font-semibold text-secondary-light hover:text-secondary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-control"
    >
      {label}
      <ArrowRightIcon className="size-3.5" />
    </button>
  );
}
