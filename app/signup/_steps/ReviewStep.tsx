'use client';

import { useState } from 'react';
import { Section } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { apiFetch, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';
import { useWizardStore } from '@/lib/store/wizardStore';

/**
 * Onboarding step 5 (Roomick-UI.pdf "Review") — read-only recap of
 * everything the wizard has collected, built straight from `wizardStore`'s
 * draft (nothing below has been sent to the backend yet — see
 * PHASE_NOTES.md's "deferred submission" entry). Uses `Section` (not
 * `Card`) throughout: its own header comment documents `primary-light` as
 * reserved for "whole-page review/summary wrappers" specifically, so this
 * is the one screen in the wizard that's visually distinct from the
 * secondary-tinted forms before it.
 *
 * "Finish" is where the real work happens: it fires `configure-mode` →
 * create branch → create room type → bulk-create rooms → (if any) send
 * staff invites, in sequence, against the real backend. Each step's
 * result id is written back to `wizardStore` (`brandId`, `branchId`, …)
 * the moment it succeeds — so if step 3 fails after steps 1–2 already
 * created real resources, clicking "Finish" again picks up from step 3
 * instead of re-running (and failing on) the ones that already worked.
 */
export function ReviewStep({ onBack, onFinish }: { onBack: () => void; onFinish: () => void }) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const tenantId = useAuthStore((state) => state.user?.tenantId);
  const wizard = useWizardStore();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { owner, brandMode, branch, roomType, rooms, staffInvites, invitedStaff } = wizard;
  const roomCount = rooms ? rooms.to - rooms.from + 1 : 0;

  async function handleFinish() {
    if (!owner || !brandMode || !branch || !roomType || !rooms) return;
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

      let branchId = wizard.branchId;
      if (!branchId) {
        const result = await apiFetch<{ id: string }>(`/brands/${brandId}/branches`, {
          method: 'POST',
          accessToken: accessToken ?? undefined,
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
        branchId = result.id;
        wizard.patch({ branchId });
      }

      let roomTypeId = wizard.roomTypeId;
      if (!roomTypeId) {
        const result = await apiFetch<{ id: string }>(`/branches/${branchId}/room-types`, {
          method: 'POST',
          accessToken: accessToken ?? undefined,
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
        roomTypeId = result.id;
        wizard.patch({ roomTypeId });
      }

      if (wizard.createdRoomCount === 0) {
        const created = await apiFetch<unknown[]>(`/branches/${branchId}/rooms/bulk`, {
          method: 'POST',
          accessToken: accessToken ?? undefined,
          tenantId,
          body: {
            roomTypeId,
            range: { from: rooms.from, to: rooms.to, prefix: rooms.prefix || undefined },
            view: rooms.view || undefined,
          },
        });
        wizard.patch({ createdRoomCount: created.length });
      }

      if (!wizard.staffInvitesSent && staffInvites.length > 0) {
        await apiFetch(`/branches/${branchId}/staff/invite`, {
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

  if (!owner || !brandMode || !branch || !roomType || !rooms) return null;

  return (
    <div className="flex flex-col gap-4">
      <Section label="Organization">
        <Row label="Subdomain" value={owner.subdomain} />
        <Row label="Structure" value={brandMode === 'single' ? 'Single-Brand' : 'Multi-Brand'} />
      </Section>

      <Section label="Branch">
        <Row label="Name" value={branch.name} />
        {branch.category ? <Row label="Category" value={branch.category} /> : null}
        <Row label="Currency" value={branch.currency} />
        <Row label="Timezone" value={branch.timezone} />
      </Section>

      <Section label="Rooms">
        <Row label="Room Type" value={roomType.name} />
        <Row label="Base Rate" value={`${branch.currency} ${roomType.baseRate}`} />
        <Row label="Room Count" value={String(roomCount)} />
      </Section>

      {invitedStaff.length > 0 ? (
        <Section label="Staff Invited">
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-small text-secondary-light">{label}</span>
      <span className="text-body font-semibold text-secondary">{value}</span>
    </div>
  );
}
