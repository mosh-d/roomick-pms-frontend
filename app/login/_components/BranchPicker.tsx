'use client';

import { useEffect, useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { RadioCard, type RadioCardOption } from '@/components/ui/RadioCard';
import { apiFetch, ApiError } from '@/lib/api';

type Branch = { id: string; name: string };

/**
 * Post-login branch/property picker (Cloudbeds-style) — the caller (see
 * `app/login/page.tsx`) only renders this when the signed-in account has
 * roles on more than one branch (`getDistinctBranchIds`, `lib/branches.ts`).
 * Fetches real names via `GET /auth/me/branches` rather than taking a list
 * of ids as a prop — the JWT's own `roles` claim only carries branchIds,
 * never names, and this is the one purpose-built endpoint that resolves
 * them (see that route's own backend comment for why a generic branches
 * list wasn't the answer).
 */
export function BranchPicker({
  accessToken,
  tenantId,
  onSelect,
}: {
  accessToken: string;
  tenantId: string;
  onSelect: (branchId: string, branchName: string) => void;
}) {
  const [branches, setBranches] = useState<Branch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<Branch[]>('/auth/me/branches', { accessToken, tenantId })
      .then((result) => {
        if (!cancelled) setBranches(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      });
    return () => {
      cancelled = true;
    };
    // accessToken/tenantId are stable for the lifetime of this screen —
    // this should only ever run once, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleContinue() {
    const branch = branches?.find((b) => b.id === selected);
    if (!branch) return;
    onSelect(branch.id, branch.name);
  }

  if (error) {
    return (
      <Container className="max-w-xl py-16">
        <h1 className="text-title font-bold text-secondary mb-2">Something went wrong</h1>
        <p className="text-body text-red-600">{error}</p>
      </Container>
    );
  }

  if (!branches) {
    return (
      <Container className="max-w-xl py-16">
        <p className="text-body text-secondary-light">Loading your properties…</p>
      </Container>
    );
  }

  const options: RadioCardOption<string>[] = branches.map((b) => ({ value: b.id, title: b.name }));

  return (
    <Container className="max-w-xl py-16">
      <h1 className="text-title font-bold text-secondary mb-2">Choose a property</h1>
      <p className="text-body text-secondary-light mb-8">
        You have access to more than one — pick which one to work in.
      </p>
      <div className="flex flex-col gap-4">
        <Section label="Properties">
          <RadioCard name="branchPicker" tone="secondary" options={options} value={selected} onChange={setSelected} />
        </Section>
        <Button type="button" onClick={handleContinue} disabled={!selected}>
          Continue
        </Button>
      </div>
    </Container>
  );
}
