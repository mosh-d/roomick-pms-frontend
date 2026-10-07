'use client';

import { Card } from '@/components/ui/Card';
import { PlusIcon, XIcon } from '@/components/ui/Icons';
import { emptyTaxRuleDraft, taxRuleProblem, type TaxRuleDraftValues } from '@/lib/taxes';
import { TaxRuleFields } from './TaxRuleFields';

export interface TaxRuleDraft extends TaxRuleDraftValues {
  localId: string;
}

export function newTaxRuleDraft(): TaxRuleDraft {
  return { ...emptyTaxRuleDraft(), localId: crypto.randomUUID() };
}

/** Each rule's problem (or null), plus a clash when two rules share a name — the server refuses two active taxes with one name at a branch. */
export function taxRuleListProblems(rules: TaxRuleDraft[]): Array<string | null> {
  return rules.map((rule, index) => {
    const own = taxRuleProblem(rule);
    if (own) return own;
    const name = rule.name.trim().toLowerCase();
    const earlier = rules.slice(0, index).some((other) => other.name.trim().toLowerCase() === name);
    return earlier ? `Another rule is already called “${rule.name.trim()}”` : null;
  });
}

/**
 * The reference's Tax Rule Builder (Roomick-UI.pdf, onboarding): a card per
 * rule — "Rule 1", "Rule 2", each with its own × — and "Add Tax Rule" under
 * them. A draft list only; whoever owns it decides when it's saved.
 *
 * `showErrors` turns on each card's problem once the person has tried to
 * move on, rather than shouting at a rule they've only just started.
 */
export function TaxRuleBuilder({
  idPrefix,
  rules,
  onChange,
  currency,
  showErrors,
}: {
  idPrefix: string;
  rules: TaxRuleDraft[];
  onChange: (rules: TaxRuleDraft[]) => void;
  currency?: string;
  showErrors: boolean;
}) {
  const problems = taxRuleListProblems(rules);

  return (
    <div className="flex flex-col gap-3">
      {rules.map((rule, index) => (
        <Card key={rule.localId} tone="secondary" className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-body font-bold text-surface">Rule {index + 1}</span>
            <button
              type="button"
              aria-label={`Remove rule ${index + 1}`}
              onClick={() => onChange(rules.filter((r) => r.localId !== rule.localId))}
              className="p-1 rounded-control text-surface hover:bg-secondary/10 cursor-pointer"
            >
              <XIcon className="size-4" />
            </button>
          </div>
          <TaxRuleFields
            idPrefix={`${idPrefix}-${index + 1}`}
            value={rule}
            onChange={(next) => onChange(rules.map((r) => (r.localId === rule.localId ? { ...next, localId: rule.localId } : r)))}
            currency={currency}
          />
          {showErrors && problems[index] ? <p className="text-small text-red-600">{problems[index]}</p> : null}
        </Card>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rules, newTaxRuleDraft()])}
        className="self-end inline-flex items-center gap-1.5 text-small font-semibold text-surface underline cursor-pointer"
      >
        <PlusIcon className="size-4" />
        Add Tax Rule
      </button>
    </div>
  );
}
