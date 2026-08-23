'use client';

import { Modal } from './Modal';
import { Button } from './Button';

/**
 * A yes/no gate in front of a destructive action, built on the same Modal
 * primitive as everything else rather than a one-off. First need: deleting
 * a branch mid-onboarding discards every building/floor/room type/room
 * configured under it — real, easy-to-lose work, not a trivial undo — so
 * the "×" that used to fire immediately now opens this instead.
 *
 * Deliberately untyped beyond its own props (no generic "what's being
 * deleted" payload) — the caller already has whatever id it needs in scope
 * via closures on `onConfirm`, so this only owns the copy and the two
 * buttons.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="text-body text-secondary-light">{description}</p>
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button type="button" variant="danger" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
