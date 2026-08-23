'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

export type WizardPhaseKey = 'owner' | 'org' | 'branch' | 'review';

const PHASES: { key: WizardPhaseKey; label: string }[] = [
  { key: 'owner', label: 'Owner Account Form' },
  { key: 'org', label: 'Organization Structure' },
  { key: 'branch', label: 'Branch Setup' },
  { key: 'review', label: 'Review' },
];

/**
 * The wizard's persistent chrome — top bar (wordmark, breadcrumb, Cancel)
 * and left sidebar (numbered phase list) — replicated from Roomick-UI.pdf's
 * onboarding pages, not approximated. Without this, every step rendered as
 * a bare centered form with no visual separation between them, which read
 * as "everything is one page" even though the underlying step machine
 * (see page.tsx) was already correctly split — the chrome is what makes
 * that separation visible.
 *
 * The reference's fine-grained screens (this wizard has 10 internal
 * `WizardStep`s — register, verify, auto-login, org-structure,
 * branch-setup, room-type, rooms, staff-invite, review, complete)
 * collapse into the 4 named phases the reference's sidebar actually shows
 * (its own "Branch Setup" page bundles Property Details + Tax Rules +
 * Staff Invite into one phase, for example) — `page.tsx` maps
 * each internal step to one of these 4 via `PHASE_FOR_STEP`.
 *
 * The reference also shows a top-right "Continue" button duplicating each
 * form's own submit button — not replicated here: wiring a second submit
 * trigger for every step's form would mean either faking a disabled button
 * on steps with no submit-ready state to check, or threading a submit
 * handler up through every step component. `Cancel` (a real link back to
 * the marketing/home route) is the one top-bar action that's genuinely
 * simple to wire, so that's what's here; each step's own submit button
 * (already present, already working) remains the way to advance.
 *
 * Sidebar phases the wizard has already passed are real, clickable
 * navigation (`onNavigate`) — not just `cursor-pointer` styling with
 * nothing behind it, which would just be a different way of lying about
 * what's interactive. The current phase and any phase still ahead aren't
 * clickable: jumping forward past a step that hasn't run yet has nothing
 * to land on, and re-submitting an already-passed step that already
 * created a real resource (e.g. `register()`, which creates the tenant)
 * will surface the backend's own "already exists" error rather than
 * silently duplicating anything — a rough edge worth knowing about, not
 * hidden, until each step's re-edit semantics are designed properly.
 */
export function WizardShell({
  currentPhase,
  onNavigate,
  children,
}: {
  currentPhase: WizardPhaseKey;
  onNavigate?: (phase: WizardPhaseKey) => void;
  children: ReactNode;
}) {
  const currentIndex = PHASES.findIndex((phase) => phase.key === currentPhase);
  const currentLabel = PHASES[currentIndex]?.label ?? '';
  const landingUrl = process.env.NEXT_PUBLIC_LANDING_URL ?? 'http://localhost:3002';

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-accent/20 px-6 py-4">
        <div className="flex items-center gap-3 text-small min-w-0">
          <a
            href={landingUrl}
            className="font-display text-header font-bold text-primary-text shrink-0 hover:brightness-110 transition-[filter]"
          >
            Roomick
          </a>
          <span className="text-accent shrink-0">/</span>
          <span className="text-secondary-light shrink-0">Organization Onboarding</span>
          <span className="text-accent shrink-0">/</span>
          <span className="font-semibold text-secondary truncate">{currentLabel}</span>
        </div>
        <Link
          href="/"
          className="shrink-0 text-small font-semibold text-secondary border border-accent/40 rounded-control px-4 py-2 hover:bg-accent/10 transition-colors"
        >
          Cancel
        </Link>
      </header>

      <div className="flex flex-1">
        <aside className="w-60 shrink-0 border-r border-accent/20 px-4 py-6 flex flex-col gap-2">
          {PHASES.map((phase, index) => {
            const isCurrent = index === currentIndex;
            const isDone = index < currentIndex;
            const content = (
              <>
                <span
                  className={`flex items-center justify-center size-6 shrink-0 rounded-full border text-tiny font-semibold ${
                    isCurrent || isDone ? 'border-primary text-primary-text bg-primary-light/40' : 'border-accent text-accent-dark'
                  }`}
                >
                  {index + 1}
                </span>
                <span className={`text-small ${isCurrent ? 'font-semibold text-secondary' : 'text-secondary-light'}`}>
                  {phase.label}
                </span>
              </>
            );
            const sharedClasses = `flex items-center gap-3 rounded-control border px-3 py-2 text-left ${
              isCurrent ? 'border-primary bg-primary-light/20' : 'border-accent/30'
            }`;

            if (isDone && onNavigate) {
              return (
                <button
                  key={phase.key}
                  type="button"
                  onClick={() => onNavigate(phase.key)}
                  className={`${sharedClasses} cursor-pointer hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors`}
                >
                  {content}
                </button>
              );
            }
            return (
              <div key={phase.key} className={sharedClasses}>
                {content}
              </div>
            );
          })}
        </aside>

        <main className="flex-1 px-6 py-10">{children}</main>
      </div>
    </div>
  );
}
