'use client';

import { useState } from 'react';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { YesNoToggle } from '@/components/ui/YesNoToggle';
import { Button } from '@/components/ui/Button';
import { ApiError } from '@/lib/api';
import { useSetTurndownPolicyMutation, type BranchDetail, type TurndownScope } from '@/lib/propertyConfig';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

const SCOPE_OPTIONS = [
  { value: 'all', label: 'Every occupied room' },
  { value: 'vip', label: 'VIP guests only' },
];

/**
 * The evening turndown: a housekeeping task for each occupied room the
 * branch turns down, raised for the arrival evening at check-in and for every
 * night after by the night audit. It tidies the room for the night and
 * doesn't move it along the cleaning ladder.
 */
export function TurndownSection({ branch, auth }: { branch: BranchDetail; auth: AuthOpts }) {
  const mutation = useSetTurndownPolicyMutation(branch.id, auth);
  const [enabled, setEnabled] = useState(branch.turndownPolicy !== null);
  const [scope, setScope] = useState<string | null>(branch.turndownPolicy?.scope ?? 'all');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    mutation.mutate(enabled ? { enabled, scope: (scope ?? 'all') as TurndownScope } : { enabled }, {
      onSuccess: () => setSaved(true),
      onError: (e) => setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.'),
    });
  }

  return (
    <Section label="Turndown Service">
      <Card tone="secondary" className="flex flex-col gap-3 max-w-lg">
        <YesNoToggle
          label="Turn rooms down in the evening"
          name="turndownEnabled"
          value={enabled ? 'yes' : 'no'}
          onChange={(v) => {
            setEnabled(v === 'yes');
            setSaved(false);
            setError(null);
          }}
        />
        {enabled ? (
          <Select
            id="turndown-scope"
            label="Whose rooms"
            options={SCOPE_OPTIONS}
            value={scope}
            onChange={(value) => {
              setScope(value);
              setSaved(false);
            }}
          />
        ) : null}
        <p className="text-tiny text-surface-muted">
          A turndown task goes on the Task Board for each of these rooms every evening a guest is staying the night. The desk can also request one for any occupied room from the Room Status Board.
        </p>
        {error ? <p className="text-small text-red-600">{error}</p> : null}
        {saved ? <p className="text-small text-green-700">Saved.</p> : null}
        <div>
          <Button type="button" onClick={save} disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save Turndown'}
          </Button>
        </div>
      </Card>
    </Section>
  );
}
