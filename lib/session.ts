/**
 * Whether the person is still here — not merely whether a session exists.
 * Taken from the Five Clover PMS, which learned each rule the hard way:
 *
 * - **An hour untouched ends the session.** The access token lasts 15
 *   minutes and renews quietly while someone works; a front-desk terminal
 *   left alone for an hour is signed out, and nothing reopens it but a fresh
 *   sign-in. Before this, a session renewed itself for as long as anyone
 *   opened the app within 30 days — in practice, forever.
 * - **Only a person moves the clock**: a click or a key (see the dashboard
 *   layout), throttled to one stamp a minute. Never a network response or
 *   a renewal — the app polls on its own (alerts every minute), and that
 *   must not keep an abandoned terminal signed in.
 * - **Loading a page isn't activity**, and neither is touching a session
 *   that's already over: the F5 that reloads the page reaches the page
 *   first, and counting it signed a night-old session straight back in.
 * - **Signing in starts the clock**, rather than a stamp a previous session
 *   left behind.
 *
 * In localStorage beside the session itself, so every tab shares one clock:
 * working in one tab keeps the others alive, and an idle end ends them all.
 */

const LAST_ACTIVITY_KEY = 'roomick-last-activity';

export const IDLE_LIMIT_MS = 60 * 60 * 1000;

/** Fired when the session has ended for good mid-work — idle too long, or renewal refused. The dashboard answers with the "session has ended" prompt rather than yanking the page away. */
export const SESSION_ENDED_EVENT = 'roomick:session-ended';

const hasStorage = () => typeof window !== 'undefined';

export function startIdleClock(): void {
  if (!hasStorage()) return;
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  } catch {
    // Storage unavailable: treated as active (below).
  }
}

/** A click or a key. Unless the hour already ran out — that session is over, and touching it must not bring it back. */
export function markActivity(): void {
  if (!hasStorage() || hasBeenIdleTooLong()) return;
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  } catch {
    // Storage unavailable: treated as active.
  }
}

/** No stamp at all (storage unavailable, or a session from before this clock existed) counts as active. */
export function hasBeenIdleTooLong(now: number = Date.now()): boolean {
  if (!hasStorage()) return false;
  try {
    const stamp = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || 0);
    return stamp > 0 && now - stamp > IDLE_LIMIT_MS;
  } catch {
    return false;
  }
}

export function clearIdleClock(): void {
  if (!hasStorage()) return;
  try {
    localStorage.removeItem(LAST_ACTIVITY_KEY);
  } catch {
    // Nothing to clear.
  }
}

export function announceSessionEnded(): void {
  if (hasStorage()) window.dispatchEvent(new Event(SESSION_ENDED_EVENT));
}
