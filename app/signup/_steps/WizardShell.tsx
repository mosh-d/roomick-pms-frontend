'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import type { BranchDraft } from '@/lib/store/wizardStore';
import { XIcon, PlusIcon } from '@/components/ui/Icons';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

export type WizardPhaseKey = 'owner' | 'org' | 'branch' | 'review';

const PHASES: { key: WizardPhaseKey; label: string }[] = [
  { key: 'owner', label: 'Owner Account Form' },
  { key: 'org', label: 'Organization Structure' },
  { key: 'branch', label: 'Branch Setup' },
  { key: 'review', label: 'Review' },
];

/** What's currently focused inside the "Branch Setup" phase — drives the tree's highlight. Mirrors `page.tsx`'s step machine without needing the full `WizardStep` union here. */
export type BranchTreeFocus =
  | { kind: 'branch'; branchLocalId: string }
  | { kind: 'room-types'; branchLocalId: string }
  | { kind: 'buildings'; branchLocalId: string }
  | { kind: 'floor'; branchLocalId: string; buildingLocalId: string; floorLocalId: string }
  | null;

/**
 * The wizard's persistent chrome — top bar (wordmark, breadcrumb, Cancel)
 * and left sidebar — replicated from Roomick-UI.pdf's onboarding pages.
 *
 * The reference's fine-grained screens collapse into 4 named phases
 * (`page.tsx`'s `PHASE_FOR_STEP`), **except** "Branch Setup", which is now
 * a real expandable tree — Branch → Room Types / Buildings → Floors,
 * matching the reference exactly (Roomick-UI.pdf pages 3–5) now that "Full"
 * onboarding mode is built (see PHASE_NOTES.md: every step before this
 * used the backend's "Rooms Only" shortcut, one implicit branch/building/
 * floor, nothing to show a tree of). Room Types sits directly under the
 * branch, not nested under a building — the reference frames it per-
 * building in its own breadcrumb, but `RoomType.branchId` (confirmed
 * against the schema) and the DB reference doc's own stated hierarchy put
 * it at the branch level; a building-scoped tree row would be a fake
 * distinction with nothing backing it in storage.
 *
 * Only the *active* branch's buildings/floors auto-expand (matching the
 * reference screenshot itself: "Main Building" expanded, "Annex" and the
 * second branch collapsed) — driven by `focus`, not separate expand/
 * collapse UI state, since there's already a single source of truth for
 * "what's being edited right now".
 *
 * Sidebar phases the wizard has already passed are real, clickable
 * navigation (`onNavigate`) — not just `cursor-pointer` styling with
 * nothing behind it. The current phase and any phase still ahead aren't
 * clickable (see the `isDone` gate below) with the one deliberate
 * exception of the branch tree's own internal rows, which are always
 * navigable amongst themselves once the "Branch Setup" phase has been
 * reached at all — going from Room Type back to a different floor's Rooms,
 * or over to a second branch, isn't "skipping ahead" the way jumping to a
 * whole different *phase* early would be.
 */
export function WizardShell({
  currentPhase,
  onNavigate,
  branches,
  branchTreeFocus,
  onSelectBranch,
  onSelectRoomTypes,
  onSelectBuildings,
  onSelectFloor,
  onAddBranch,
  onRemoveBranch,
  children,
}: {
  currentPhase: WizardPhaseKey;
  onNavigate?: (phase: WizardPhaseKey) => void;
  branches?: BranchDraft[];
  branchTreeFocus?: BranchTreeFocus;
  onSelectBranch?: (branchLocalId: string) => void;
  onSelectRoomTypes?: (branchLocalId: string) => void;
  onSelectBuildings?: (branchLocalId: string) => void;
  onSelectFloor?: (branchLocalId: string, buildingLocalId: string, floorLocalId: string) => void;
  onAddBranch?: () => void;
  onRemoveBranch?: (branchLocalId: string) => void;
  children: ReactNode;
}) {
  const currentIndex = PHASES.findIndex((phase) => phase.key === currentPhase);
  const currentLabel = PHASES[currentIndex]?.label ?? '';
  const landingUrl = process.env.NEXT_PUBLIC_LANDING_URL ?? 'http://localhost:3002';

  return (
    // `h-screen` + `overflow-hidden` (not `min-h-screen`) caps the whole
    // shell to exactly one viewport, so the browser window itself never
    // scrolls — header and sidebar both stay visually fixed in place.
    // `main` gets its own `overflow-y-auto` below, so it's the only part
    // that actually scrolls, matching what was asked directly ("only the
    // main page contents scroll"). A plain `sticky` sidebar was tried
    // first and didn't hold up: the flex row's default `align-items:
    // stretch` stretches `aside` to match `main`'s full height (confirmed
    // live), leaving a sticky element with no room to ever "catch".
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="shrink-0 flex items-center justify-between gap-4 border-b border-accent/20 px-6 py-4">
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

      <div className="flex flex-1 min-h-0">
        <aside className="w-60 shrink-0 overflow-y-auto border-r border-accent/20 px-4 py-6 flex flex-col gap-2">
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

            const row =
              isDone && onNavigate ? (
                <button
                  key={phase.key}
                  type="button"
                  onClick={() => onNavigate(phase.key)}
                  className={`${sharedClasses} cursor-pointer hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors`}
                >
                  {content}
                </button>
              ) : (
                <div key={phase.key} className={sharedClasses}>
                  {content}
                </div>
              );

            // The branch tree renders once the phase has been reached at
            // all (current or done) — nothing to show a tree of before
            // that (no branches exist yet ahead of this phase).
            if (phase.key === 'branch' && (isCurrent || isDone) && branches) {
              return (
                <div key={phase.key} className="flex flex-col gap-1">
                  {row}
                  <BranchTree
                    branches={branches}
                    focus={branchTreeFocus ?? null}
                    onSelectBranch={onSelectBranch}
                    onSelectRoomTypes={onSelectRoomTypes}
                    onSelectBuildings={onSelectBuildings}
                    onSelectFloor={onSelectFloor}
                    onAddBranch={onAddBranch}
                    onRemoveBranch={onRemoveBranch}
                  />
                </div>
              );
            }
            return row;
          })}
        </aside>

        <main className="flex-1 overflow-y-auto px-6 py-10">{children}</main>
      </div>
    </div>
  );
}

function BranchTree({
  branches,
  focus,
  onSelectBranch,
  onSelectRoomTypes,
  onSelectBuildings,
  onSelectFloor,
  onAddBranch,
  onRemoveBranch,
}: {
  branches: BranchDraft[];
  focus: BranchTreeFocus;
  onSelectBranch?: (branchLocalId: string) => void;
  onSelectRoomTypes?: (branchLocalId: string) => void;
  onSelectBuildings?: (branchLocalId: string) => void;
  onSelectFloor?: (branchLocalId: string, buildingLocalId: string, floorLocalId: string) => void;
  onAddBranch?: () => void;
  onRemoveBranch?: (branchLocalId: string) => void;
}) {
  // Deleting a branch discards every building/floor/room type/room
  // configured under it — real work, not a trivial undo — so the "×"
  // opens a confirmation instead of removing it immediately. Holds the
  // branch's own localId + display name (not just a boolean) so the
  // dialog can name what's about to be deleted and `onConfirm` knows
  // which one, even though `branches` itself may re-render in between.
  const [pendingDelete, setPendingDelete] = useState<{ localId: string; name: string } | null>(null);

  return (
    <>
    <div className="flex flex-col gap-1 pl-3 border-l border-accent/20 ml-3">
      {branches.map((branch) => {
        const isActiveBranch = focus?.branchLocalId === branch.localId;
        return (
          <div key={branch.localId} className="flex flex-col gap-1">
            <TreeRow
              label={branch.name || 'Untitled branch'}
              active={isActiveBranch && focus?.kind === 'branch'}
              onClick={() => onSelectBranch?.(branch.localId)}
              onRemove={
                branches.length > 1
                  ? () => setPendingDelete({ localId: branch.localId, name: branch.name || 'Untitled branch' })
                  : undefined
              }
              emphasize
            />
            {isActiveBranch ? (
              <div className="flex flex-col gap-1 pl-3 border-l border-accent/20 ml-2">
                <TreeRow
                  label="Room Types"
                  active={focus?.kind === 'room-types'}
                  onClick={() => onSelectRoomTypes?.(branch.localId)}
                />
                {branch.buildings.map((building) => (
                  <div key={building.localId} className="flex flex-col gap-1">
                    <TreeRow
                      label={building.name || 'Untitled building'}
                      active={focus?.kind === 'buildings' && focus.branchLocalId === branch.localId}
                      onClick={() => onSelectBuildings?.(branch.localId)}
                    />
                    <div className="flex flex-col gap-1 pl-3 border-l border-accent/20 ml-2">
                      {building.floors.map((floor) => (
                        <TreeRow
                          key={floor.localId}
                          label={`Floor ${floor.floorNumber}`}
                          active={focus?.kind === 'floor' && focus.floorLocalId === floor.localId}
                          onClick={() => onSelectFloor?.(branch.localId, building.localId, floor.localId)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => onSelectBuildings?.(branch.localId)}
                  className="inline-flex items-center gap-1 text-tiny font-semibold text-primary-text hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-control px-3 py-1"
                >
                  <PlusIcon className="size-3" /> Add building
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
      <button
        type="button"
        onClick={onAddBranch}
        className="inline-flex items-center gap-1 text-tiny font-semibold text-primary-text hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-control px-3 py-1"
      >
        <PlusIcon className="size-3" /> Add branch
      </button>
    </div>
    <ConfirmDialog
      open={pendingDelete !== null}
      title="Delete branch?"
      description={`This will permanently delete "${pendingDelete?.name}" and everything configured under it — buildings, floors, room types, and rooms. This can't be undone.`}
      confirmLabel="Delete branch"
      onCancel={() => setPendingDelete(null)}
      onConfirm={() => {
        if (pendingDelete) onRemoveBranch?.(pendingDelete.localId);
        setPendingDelete(null);
      }}
    />
    </>
  );
}

function TreeRow({
  label,
  active,
  onClick,
  onRemove,
  emphasize = false,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  onRemove?: () => void;
  emphasize?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-control px-3 py-1.5 text-tiny ${
        active ? 'bg-primary text-white font-semibold' : emphasize ? 'text-secondary' : 'text-secondary-light'
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        className={`flex-1 text-left cursor-pointer truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-control ${
          active ? '' : 'hover:text-secondary'
        }`}
      >
        {label}
      </button>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          className={`shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full ${
            active ? 'text-secondary/70 hover:text-secondary' : 'text-secondary-light hover:text-secondary'
          }`}
        >
          <XIcon className="size-3" />
        </button>
      ) : null}
    </div>
  );
}
