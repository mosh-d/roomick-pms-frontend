'use client';

import { useEffect, useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Section } from '@/components/ui/Section';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { XIcon, PlusIcon } from '@/components/ui/Icons';
import { apiFetch, ApiError } from '@/lib/api';
import { staffInviteSchema, type StaffInviteFormValues } from '@/lib/schemas/onboarding';
import { useAuthStore } from '@/lib/store/authStore';
import { useWizardStore } from '@/lib/store/wizardStore';
import { useAutosaveDraft } from '@/lib/useAutosaveDraft';

type Role = { id: string; name: string };

/**
 * Onboarding step (Roomick-UI.pdf "Branch Setup" — Staff Invite section).
 * `GET /auth/roles` still loads live here (a read, not a mutation — no
 * reason to defer it), but the actual invites are no longer sent
 * immediately: like every step from Organization Structure onward (see
 * PHASE_NOTES.md's "deferred submission" entry), "Send Invites" just
 * validates and saves `{email, roleId}` rows to `wizardStore`, advancing
 * to Review — the real `POST /branches/:branchId/staff/invite` call only
 * fires once, as part of Review's "Finish" chain, once a real `branchId`
 * exists. Role *names* (for Review's display) are resolved from the
 * already-loaded roles list and stored alongside the raw rows, so Review
 * doesn't need its own `GET /auth/roles` call just to show them.
 *
 * "Invite Staff Later" in the reference maps to `onSkip` here — invites
 * are optional, matching the reference's own radio choice between
 * configuring now and skipping.
 */
export function StaffInviteStep({ onNext }: { onNext: () => void }) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const tenantId = useAuthStore((state) => state.user?.tenantId);
  const staffInvites = useWizardStore((state) => state.staffInvites);
  const patch = useWizardStore((state) => state.patch);
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<StaffInviteFormValues>({
    resolver: zodResolver(staffInviteSchema),
    defaultValues: { invites: staffInvites.length > 0 ? staffInvites : [{ email: '', roleId: '' }] },
    mode: 'onTouched',
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'invites' });

  useAutosaveDraft(watch, (values) => patch({ staffInvites: values.invites }));

  useEffect(() => {
    let cancelled = false;
    apiFetch<Role[]>('/auth/roles', { accessToken: accessToken ?? undefined, tenantId })
      .then((result) => {
        if (!cancelled) setRoles(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : 'Could not load roles.');
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, tenantId]);

  function onSubmit(values: StaffInviteFormValues) {
    const invitedStaff = values.invites.map((row) => ({
      email: row.email,
      roleName: roles?.find((role) => role.id === row.roleId)?.name ?? row.roleId,
    }));
    patch({ staffInvites: values.invites, invitedStaff });
    onNext();
  }

  const roleOptions = (roles ?? []).map((role) => ({ value: role.id, label: role.name }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Section label="Staff invite">
        {loadError ? (
          <p className="text-small text-red-600">{loadError}</p>
        ) : (
          fields.map((field, index) => (
            <div key={field.id} className="flex items-end gap-3">
              <div className="flex-1">
                <Input
                  label="Staff Email"
                  type="email"
                  {...register(`invites.${index}.email`)}
                  error={errors.invites?.[index]?.email?.message}
                />
              </div>
              <div className="flex-1">
                <Controller
                  control={control}
                  name={`invites.${index}.roleId`}
                  render={({ field: roleField }) => (
                    <Select
                      name={`invites.${index}.roleId`}
                      label="Role"
                      options={roleOptions}
                      value={roleField.value || null}
                      onChange={roleField.onChange}
                      disabled={roles === null}
                      error={errors.invites?.[index]?.roleId?.message}
                    />
                  )}
                />
              </div>
              {fields.length > 1 ? (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label="Remove invite row"
                  className="mb-2 text-secondary-light hover:text-secondary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full"
                >
                  <XIcon className="size-4" />
                </button>
              ) : null}
            </div>
          ))
        )}

        <button
          type="button"
          onClick={() => append({ email: '', roleId: '' })}
          className="inline-flex items-center gap-1 self-start text-body font-semibold text-primary-text hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-control"
        >
          <PlusIcon className="size-4" /> Add
        </button>
      </Section>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={isSubmitting} disabled={roles === null}>
          Continue
        </Button>
        <button
          type="button"
          onClick={() => {
            patch({ staffInvites: [], invitedStaff: [] });
            onNext();
          }}
          className="text-body text-secondary-light hover:text-secondary underline cursor-pointer"
        >
          Skip for now
        </button>
      </div>
    </form>
  );
}
