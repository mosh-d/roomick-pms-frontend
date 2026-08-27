'use client';

import { useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { RadioCard, type RadioCardOption } from '@/components/ui/RadioCard';
import type { DashboardBranch } from '@/lib/dashboardBranches';

/**
 * Post-login branch/property picker (Cloudbeds-style) — the caller
 * (`app/dashboard/layout.tsx`) only renders this when the signed-in
 * account resolves to more than one branch (`useMyBranches`,
 * `lib/dashboardBranches.ts`).
 *
 * Presentational — `branches` comes in as a prop rather than this
 * component fetching them itself. It used to self-fetch (when it lived
 * under `app/login/`), which meant `/login` and this component each
 * independently called the same endpoint; now `useMyBranches` is the one
 * place that runs, and its result is threaded down.
 */
export function BranchPicker({
  branches,
  onSelect,
}: {
  branches: DashboardBranch[];
  onSelect: (branchId: string, branchName: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  function handleContinue() {
    const branch = branches.find((b) => b.id === selected);
    if (!branch) return;
    onSelect(branch.id, branch.name);
  }

  const options: RadioCardOption<string>[] = branches.map((b) => ({ value: b.id, title: b.name }));

  return (
    <Container className="max-w-xl py-16">
      <h1 className="font-display text-title font-bold text-primary-dark mb-2">Choose a property</h1>
      <p className="text-body text-primary-dark/70 mb-8">
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
