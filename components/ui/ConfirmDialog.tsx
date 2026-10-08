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
 *
 * `loading`: the caller keeps the dialog open while the action runs and
 * closes it when it's done. Meanwhile the confirm button spins and can't be
 * pressed again, and the dialog can't be dismissed — a refund paid out twice
 * by a double click was the reason.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  loading = false,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  return (
    <Modal open={open} onClose={loading ? STAY_OPEN : onCancel} title={title}>
      <p className="text-body text-surface-muted">{description}</p>
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button type="button" variant="danger" onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

/** Escape and the backdrop do nothing while the action is running. */
const STAY_OPEN = () => {};
