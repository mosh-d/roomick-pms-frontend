'use client';

import { useState } from 'react';
import { Section } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { apiFetch, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';
import { useWizardStore, type BranchDraft, type RoomCardDraft, type RoomTypeDraft } from '@/lib/store/wizardStore';
import { currencySymbolFor } from '@/lib/currencies';
import { displayWithCommas } from '@/lib/numberFormat';

/**
 * Onboarding step (Roomick-UI.pdf "Review") — read-only recap, paginated
 * per branch (Back/Next through `wizard.branches`, matching the
 * reference) now that "Full" onboarding mode means there can be more than
 * one (see PHASE_NOTES.md). Owner Account and Organization Structure stay
 * single summaries — the reference splits those into their own review
 * sub-pages too, trimmed here as a reasonable scope cut, not silently
 * dropped (see PHASE_NOTES.md's carried-forward note).
 *
 * "Finish" is where the real work happens, walking the same tree Review
 * displays: for each branch — create the branch (if not already) → each
 * room type → each building → each floor → every not-yet-created room
 * card, grouped by (floor, room type, view) since `rooms/bulk` only takes
 * one `view` per call — then (first branch only) staff invites. Every
 * created id is written back onto its `localId`'d draft the moment it
 * succeeds, so a retry after a partial failure only creates what's still
 * missing, at any level of the tree, not just "restart this branch".
 */
export function ReviewStep({ onBack, onFinish }: { onBack: () => void; onFinish: () => void }) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const tenantId = useAuthStore((state) => state.user?.tenantId);
  const wizard = useWizardStore();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);

  const { owner, brandMode, branches, staffInvites, invitedStaff } = wizard;

  async function handleFinish() {
    if (!owner || !brandMode || branches.length === 0) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      let brandId = wizard.brandId;
      if (!brandId) {
        const result = await apiFetch<{ brand: { id: string } }>('/tenants/configure-mode', {
          method: 'POST',
          accessToken: accessToken ?? undefined,
          tenantId,
          body: { mode: brandMode },
        });
        brandId = result.brand.id;
        wizard.patch({ brandId });
      }

      // Working copy — mutated as calls succeed, written back to
      // wizardStore after each branch so a retry resumes from wherever it
      // actually stopped, at any level (branch/room type/building/floor/
      // room), not just "start this branch over".
      const workingBranches: BranchDraft[] = structuredClone(branches);

      for (let i = 0; i < workingBranches.length; i++) {
        await finishBranch(workingBranches[i], brandId, accessToken ?? undefined, tenantId);
        wizard.patch({ branches: structuredClone(workingBranches) });
      }

      const firstBranchId = workingBranches[0]?.id;
      if (!wizard.staffInvitesSent && staffInvites.length > 0 && firstBranchId) {
        await apiFetch(`/branches/${firstBranchId}/staff/invite`, {
          method: 'POST',
          accessToken: accessToken ?? undefined,
          tenantId,
          body: { invites: staffInvites },
        });
        wizard.patch({ staffInvitesSent: true });
      }

      onFinish();
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!owner || !brandMode || branches.length === 0) return null;

  const branch = branches[Math.min(reviewIndex, branches.length - 1)];
  const currencySymbol = currencySymbolFor(branch.currency);
  const roomCount = branch.rooms.length;

  return (
    <div className="flex flex-col gap-4">
      <Section label="Organization" tone="accent">
        <Row label="Subdomain" value={owner.subdomain} />
        <Row label="Structure" value={brandMode === 'single' ? 'Single-Brand' : 'Multi-Brand'} />
      </Section>

      {branches.length > 1 ? (
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            disabled={reviewIndex === 0}
            onClick={() => setReviewIndex((i) => i - 1)}
            className="text-body font-semibold text-primary-text hover:underline disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
          >
            ← Previous branch
          </button>
          <span className="text-small text-secondary-light">
            Branch {reviewIndex + 1} of {branches.length}
          </span>
          <button
            type="button"
            disabled={reviewIndex === branches.length - 1}
            onClick={() => setReviewIndex((i) => i + 1)}
            className="text-body font-semibold text-primary-text hover:underline disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
          >
            Next branch →
          </button>
        </div>
      ) : null}

      <Section label={branch.name || 'Branch'} tone="accent">
        <Row label="Name" value={branch.name} />
        {branch.category ? <Row label="Category" value={branch.category} /> : null}
        <Row label="Currency" value={branch.currency} />
        <Row label="Timezone" value={branch.timezone} />
      </Section>

      {branch.roomTypes.length > 0 ? (
        <Section label="Room Types" tone="accent">
          {branch.roomTypes.map((rt) => (
            <Row key={rt.localId} label={rt.name || 'Untitled'} value={`${currencySymbol}${displayWithCommas(rt.baseRate)}`} />
          ))}
        </Section>
      ) : null}

      {branch.buildings.length > 0 ? (
        <Section label="Buildings" tone="accent">
          {branch.buildings.map((building) => (
            <div key={building.localId} className="flex flex-col gap-2">
              <span className="text-small font-semibold text-secondary">{building.name || 'Untitled building'}</span>
              {building.floors.map((floor) => {
                const roomsOnFloor = branch.rooms.filter((r) => r.floorLocalId === floor.localId);
                const floorLabel = `Floor ${floor.floorNumber}`;
                return (
                  <div key={floor.localId} className="pl-4 flex flex-col gap-1.5">
                    <span className="text-small text-accent-dark">{floorLabel}</span>
                    {roomsOnFloor.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {roomsOnFloor.map((room) => (
                          <RoomChip
                            key={room.localId}
                            room={room}
                            roomType={branch.roomTypes.find((rt) => rt.localId === room.roomTypeLocalId)}
                            floorLabel={floorLabel}
                            currencySymbol={currencySymbol}
                          />
                        ))}
                      </div>
                    ) : (
                      <span className="text-small text-accent-dark pl-1">No rooms yet</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </Section>
      ) : null}

      <Section label="Rooms" tone="accent">
        <Row label="Total Room Count" value={String(roomCount)} />
      </Section>

      {invitedStaff.length > 0 ? (
        <Section label="Staff Invited" tone="accent">
          {invitedStaff.map((staff) => (
            <Row key={staff.email} label={staff.email} value={staff.roleName} />
          ))}
        </Section>
      ) : null}

      {submitError ? <p className="text-small text-red-600">{submitError}</p> : null}

      <div className="flex items-center gap-3">
        <Button type="button" variant="secondary" onClick={onBack} disabled={submitting}>
          Back
        </Button>
        <Button type="button" onClick={handleFinish} loading={submitting}>
          Finish
        </Button>
      </div>
    </div>
  );
}

/** Mutates `branch` in place, writing real ids back onto it as each backend call succeeds. */
async function finishBranch(branch: BranchDraft, brandId: string, accessToken: string | undefined, tenantId: string | undefined) {
  if (!branch.id) {
    const result = await apiFetch<{ id: string }>(`/brands/${brandId}/branches`, {
      method: 'POST',
      accessToken,
      tenantId,
      body: {
        name: branch.name,
        address: {
          street: branch.street,
          city: branch.city,
          state: branch.state || undefined,
          country: branch.country,
          zip: branch.zip || undefined,
        },
        timezone: branch.timezone,
        currency: branch.currency,
        checkInTime: branch.checkInTime || undefined,
        checkOutTime: branch.checkOutTime || undefined,
        category: branch.category || undefined,
      },
    });
    branch.id = result.id;
  }
  const branchId = branch.id;

  for (const roomType of branch.roomTypes) {
    if (roomType.id) continue;
    const result = await apiFetch<{ id: string }>(`/branches/${branchId}/room-types`, {
      method: 'POST',
      accessToken,
      tenantId,
      body: {
        name: roomType.name,
        baseRate: roomType.baseRate,
        capacity: { adults: roomType.adults, children: roomType.children },
        bedType: roomType.bedType || undefined,
        sizeM2: roomType.sizeM2,
        amenities: roomType.amenities,
      },
    });
    roomType.id = result.id;
  }

  for (const building of branch.buildings) {
    if (!building.id) {
      const result = await apiFetch<{ id: string }>(`/branches/${branchId}/buildings`, {
        method: 'POST',
        accessToken,
        tenantId,
        body: { name: building.name },
      });
      building.id = result.id;
    }
    for (const floor of building.floors) {
      if (floor.id) continue;
      const result = await apiFetch<{ id: string }>(`/buildings/${building.id}/floors`, {
        method: 'POST',
        accessToken,
        tenantId,
        body: { floorNumber: floor.floorNumber, label: floor.label || undefined },
      });
      floor.id = result.id;
    }
  }

  await createRooms(branch, branchId, accessToken, tenantId);
}

/**
 * `rooms/bulk` takes one `roomTypeId`/`floorId`/`view` per call — real
 * per-room views (`Room.view`) mean cards have to be grouped by
 * (floor, room type, view) into one call per distinct combination, not one
 * call for the whole branch. Only cards without an `id` yet are included,
 * so a retry doesn't re-create rooms that already exist; the response's
 * `number` field matches results back to the specific card that requested
 * it (bulk-create doesn't return results in a guaranteed order otherwise).
 */
async function createRooms(branch: BranchDraft, branchId: string, accessToken: string | undefined, tenantId: string | undefined) {
  const pending = branch.rooms.filter((r) => !r.id);
  const groups = new Map<string, RoomCardDraft[]>();
  for (const card of pending) {
    const key = `${card.floorLocalId}::${card.roomTypeLocalId}::${card.view ?? ''}`;
    const group = groups.get(key);
    if (group) group.push(card);
    else groups.set(key, [card]);
  }

  for (const group of groups.values()) {
    const floor = branch.buildings.flatMap((b) => b.floors).find((f) => f.localId === group[0].floorLocalId);
    const roomType = branch.roomTypes.find((rt) => rt.localId === group[0].roomTypeLocalId);
    if (!floor?.id || !roomType?.id) continue;
    const created = await apiFetch<{ id: string; number: string }[]>(`/branches/${branchId}/rooms/bulk`, {
      method: 'POST',
      accessToken,
      tenantId,
      body: {
        roomTypeId: roomType.id,
        floorId: floor.id,
        numbers: group.map((c) => c.number),
        view: group[0].view || undefined,
      },
    });
    for (const card of group) {
      const match = created.find((r) => r.number === card.number);
      if (match) card.id = match.id;
    }
  }
}

/** Always rendered inside a `tone="accent"` Section (see this file's other usages) — the label uses `text-accent-dark`, not `text-secondary-light`, to stay in the same slate family as the card itself rather than mixing in secondary's purple hue. The value keeps `text-secondary` regardless of tone, matching Card.tsx's own documented convention: value text needs the contrast, not a tone-matched color. */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-small text-accent-dark">{label}</span>
      <span className="text-body font-semibold text-secondary">{value}</span>
    </div>
  );
}

/**
 * A room-number pill (Roomick-UI.pdf's Review page: Buildings → Floors →
 * room chips, each popping its own detail card on interaction) — reads
 * `room.number` alone at rest, revealing the room's full type/rate/size/
 * bed/view/amenities in a floating card on hover, focus, or click (click
 * as an explicit toggle, not just a hover side effect, since hover alone
 * doesn't exist on touch).
 *
 * Deliberately recolored off the reference: the mockup renders this pair
 * as a gold chip + a purple detail card — two different hue families. This
 * screen's own review cards are already `tone="accent"` throughout (a
 * direct correction, not the mockup's own choice — see Section.tsx), so
 * both the chip and its popup stay in that same accent/slate family. The
 * popup is solid white, not translucent-accent, on purpose: it's a
 * floating overlay meant to sit *above* the room grid, not tint through
 * it — a translucent card here would let the chips underneath bleed
 * through and read as smudged rather than layered.
 */
function RoomChip({
  room,
  roomType,
  floorLabel,
  currencySymbol,
}: {
  room: RoomCardDraft;
  roomType: RoomTypeDraft | undefined;
  floorLabel: string;
  currencySymbol: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        className="rounded-pill bg-accent-dark/10 border border-accent-dark/20 px-3 py-1 text-small font-semibold text-secondary cursor-pointer hover:bg-accent-dark/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {room.number}
      </button>
      {open ? (
        <div className="absolute z-20 top-full left-0 mt-1 w-64 rounded-card border border-accent-dark/30 bg-white shadow-lg p-3 flex flex-col gap-1.5 text-left">
          <RoomDetailRow label="Floor" value={floorLabel} />
          <RoomDetailRow label="Room Type" value={roomType?.name || 'Untitled'} />
          <RoomDetailRow
            label="Base Price (per night)"
            value={roomType ? `${currencySymbol}${displayWithCommas(roomType.baseRate)}` : '—'}
          />
          {roomType?.sizeM2 ? <RoomDetailRow label="Room Size" value={`${roomType.sizeM2} m²`} /> : null}
          {roomType?.bedType ? <RoomDetailRow label="Bed Type" value={roomType.bedType} /> : null}
          <RoomDetailRow label="View" value={room.view || 'No view'} />
          {roomType?.amenities && roomType.amenities.length > 0 ? (
            <div className="flex flex-wrap gap-1 mt-1">
              {roomType.amenities.map((amenity) => (
                <span key={amenity} className="rounded-pill bg-accent-dark/10 text-accent-dark text-tiny px-2 py-0.5">
                  {amenity}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function RoomDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-tiny text-accent-dark">{label}</span>
      <span className="text-small font-semibold text-secondary">{value}</span>
    </div>
  );
}
