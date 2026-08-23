'use client';

import { useEffect, useRef } from 'react';
import type { FieldValues, UseFormWatch } from 'react-hook-form';

/**
 * Every deferred-submission step (Organization Structure onward, see
 * PHASE_NOTES.md) only wrote its values into `wizardStore` on submit —
 * reported directly: a reload while still mid-form (before clicking
 * Continue) lost whatever hadn't been submitted yet, since react-hook-form
 * only holds live keystrokes in that form's own local state until then.
 * This mirrors every change into the persisted store instead (debounced,
 * not on every render), so a reload resumes from `defaultValues` mid-edit,
 * not just mid-step.
 *
 * `save` is read through a ref, not a `useEffect` dependency — RHF's
 * `watch` function is stable across renders (safe to depend on directly),
 * but `save` is typically a fresh closure every render (e.g. `(values) =>
 * patch({ branch: values })`); depending on it directly would tear down
 * and resubscribe the watch on every keystroke instead of just debouncing
 * the write.
 */
export function useAutosaveDraft<T extends FieldValues>(watch: UseFormWatch<T>, save: (values: T) => void, debounceMs = 400) {
  const saveRef = useRef(save);
  // Refs can't be written during render (React flags it — mutating state
  // outside the render/commit lifecycle) — this effect just keeps the ref
  // current after each render instead, same "latest callback" pattern as
  // the ref update itself.
  useEffect(() => {
    saveRef.current = save;
  });

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const subscription = watch((values) => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => saveRef.current(values as T), debounceMs);
    });
    return () => {
      subscription.unsubscribe();
      if (timeout) clearTimeout(timeout);
    };
  }, [watch, debounceMs]);
}
