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
 * The reference's fine-grained screens (this wizard has ~10 internal
 * `WizardStep`s — register, verify, auto-login, org-structure,
 * create-brand, branch-setup, room-type, rooms, staff-invite, review,
 * complete) collapse into the 4 named phases the reference's sidebar
 * actually shows (its own "Branch Setup" page bundles Property Details +
 * Tax Rules + Staff Invite into one phase, for example) — `page.tsx` maps
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
 */
export function WizardShell({ currentPhase, children }: { currentPhase: WizardPhaseKey; children: ReactNode }) {
  const currentIndex = PHASES.findIndex((phase) => phase.key === currentPhase);
  const currentLabel = PHASES[currentIndex]?.label ?? '';

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-accent/20 px-6 py-4">
        <div className="flex items-center gap-3 text-small min-w-0">
          <span className="font-display text-header font-bold text-primary-text shrink-0">Roomick</span>
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
            return (
              <div
                key={phase.key}
                className={`flex items-center gap-3 rounded-control border px-3 py-2 ${
                  isCurrent ? 'border-primary bg-primary-light/20' : 'border-accent/30'
                }`}
              >
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
              </div>
            );
          })}
        </aside>

        <main className="flex-1 px-6 py-10">{children}</main>
      </div>
    </div>
  );
}
