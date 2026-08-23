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

type Role = { id: string; name: string };
export type InvitedStaff = { email: string; roleName: string };

/**
 * Onboarding step (Roomick-UI.pdf "Branch Setup" — Staff Invite section).
 * Real, working endpoint (`POST /branches/:branchId/staff/invite` +
 * `GET /auth/roles` to resolve role names to the roleId the DTO needs) —
 * unlike Tax Rule Configuration and Logo Upload shown on the same
 * reference pages, which have no backend support at all yet (no
 * tax-rules controller, no file-upload endpoint) and stay out of this
 * wizard for that reason, not by oversight. See PHASE_NOTES.md.
 *
 * "Invite Staff Later" in the reference maps to `onSkip` here — invites
 * are optional, matching the reference's own radio choice between
 * configuring now and skipping.
 */
export function StaffInviteStep({
  branchId,
  onDone,
}: {
  branchId: string;
  onDone: (invited: InvitedStaff[]) => void;
}) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const tenantId = useAuthStore((state) => state.user?.tenantId);
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<StaffInviteFormValues>({
    resolver: zodResolver(staffInviteSchema),
    defaultValues: { invites: [{ email: '', roleId: '' }] },
    mode: 'onBlur',
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'invites' });

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

  async function onSubmit(values: StaffInviteFormValues) {
    setFormError(null);
    try {
      await apiFetch(`/branches/${branchId}/staff/invite`, {
        method: 'POST',
        accessToken: accessToken ?? undefined,
        tenantId,
        body: values,
      });
      const invited = values.invites.map((row) => ({
        email: row.email,
        roleName: roles?.find((role) => role.id === row.roleId)?.name ?? row.roleId,
      }));
      onDone(invited);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
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

      {formError ? <p className="text-small text-red-600">{formError}</p> : null}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={isSubmitting} disabled={roles === null}>
          Send Invites
        </Button>
        <button
          type="button"
          onClick={() => onDone([])}
          className="text-body text-secondary-light hover:text-secondary underline cursor-pointer"
        >
          Skip for now
        </button>
      </div>
    </form>
  );
}
