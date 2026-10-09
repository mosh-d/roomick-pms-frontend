'use client';

import { useState } from 'react';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select, type SelectOption } from '@/components/ui/Select';
import { MultiSelectTagInput } from '@/components/ui/MultiSelectTagInput';
import { YesNoToggle } from '@/components/ui/YesNoToggle';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Table, type TableColumn } from '@/components/ui/Table';
import { ApiError } from '@/lib/api';
import { formatMoney } from '@/lib/numberFormat';
import {
  BASIS_LABELS,
  PACKAGE_CHARGE_LABELS,
  usePackagesQuery,
  useRemovePackageMutation,
  useSavePackageMutation,
  type PackageBasis,
  type PackageChargeType,
  type StayPackage,
} from '@/lib/packages';
import type { RoomTypeSummary } from '@/lib/rooms';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

const BASIS_OPTIONS: SelectOption[] = (Object.keys(BASIS_LABELS) as PackageBasis[]).map((value) => ({ value, label: `Priced ${BASIS_LABELS[value]}` }));
const CHARGE_OPTIONS: SelectOption[] = (Object.keys(PACKAGE_CHARGE_LABELS) as PackageChargeType[]).map((value) => ({ value, label: PACKAGE_CHARGE_LABELS[value] }));

/**
 * Packages: things sold with a stay at a set price — breakfast, an airport
 * pick-up — added when a stay is booked (by the desk, or by the guest online
 * when it's offered there). Each posts to the bill as its own charge, with
 * the night or once for the stay, and is taxed like any charge of its type.
 */
export function PackagesSection({
  branchId,
  roomTypes,
  currencySymbol,
  canManage,
  auth,
}: {
  branchId: string;
  roomTypes: RoomTypeSummary[];
  currencySymbol: string;
  canManage: boolean;
  auth: AuthOpts;
}) {
  const packagesQuery = usePackagesQuery(branchId, auth);
  const saveMutation = useSavePackageMutation(branchId, auth);
  const removeMutation = useRemovePackageMutation(branchId, auth);
  const [editing, setEditing] = useState<{ pkg: StayPackage | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const roomTypeName = new Map(roomTypes.map((rt) => [rt.id, rt.name]));

  const columns: TableColumn<StayPackage>[] = [
    { key: 'name', label: 'Package', render: (p) => <span className="font-semibold">{p.name}</span>, sortValue: (p) => p.name },
    { key: 'price', label: 'Price', render: (p) => `${formatMoney(p.price, currencySymbol)} ${BASIS_LABELS[p.basis]}`, sortValue: (p) => Number(p.price) },
    { key: 'type', label: 'Posts as', render: (p) => PACKAGE_CHARGE_LABELS[p.chargeType] ?? p.chargeType },
    { key: 'rooms', label: 'Room types', render: (p) => (p.roomTypeIds.length ? p.roomTypeIds.map((id) => roomTypeName.get(id) ?? '—').join(', ') : 'All') },
    { key: 'online', label: 'Online', render: (p) => (p.showOnline ? 'Offered' : 'Desk only') },
    { key: 'status', label: 'Status', render: (p) => (p.isActive ? 'On sale' : 'Off sale'), sortValue: (p) => (p.isActive ? 0 : 1) },
    ...(canManage
      ? [
          {
            key: 'action',
            label: '',
            align: 'right' as const,
            render: (p: StayPackage) => (
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing({ pkg: p })}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  loading={removeMutation.isPending && removeMutation.variables === p.id}
                  onClick={() => {
                    setError(null);
                    removeMutation.mutate(p.id, { onError: (e) => setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.') });
                  }}
                >
                  Remove
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <Section label="Packages">
      <p className="text-small text-surface-muted">
        Sold with a stay at a set price and posted to the bill as its own charge — with each night, or once at check-in. A stay keeps the price it was booked at.
      </p>
      {canManage ? (
        <Button type="button" size="sm" className="self-start" onClick={() => setEditing({ pkg: null })}>
          Add Package
        </Button>
      ) : null}
      {error ? <p className="text-small text-red-600">{error}</p> : null}
      {packagesQuery.isLoading ? (
        <p className="text-body text-surface-muted">Loading packages…</p>
      ) : (
        <Card tone="secondary">
          <Table columns={columns} rows={packagesQuery.data ?? []} emptyMessage="No packages yet." />
        </Card>
      )}
      {editing ? (
        <PackageDialog
          key={editing.pkg?.id ?? 'new'}
          pkg={editing.pkg}
          roomTypes={roomTypes}
          currencySymbol={currencySymbol}
          onSave={(body) => saveMutation.mutateAsync({ packageId: editing.pkg?.id ?? null, body })}
          saving={saveMutation.isPending}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </Section>
  );
}

function PackageDialog({
  pkg,
  roomTypes,
  currencySymbol,
  onSave,
  saving,
  onClose,
}: {
  pkg: StayPackage | null;
  roomTypes: RoomTypeSummary[];
  currencySymbol: string;
  onSave: (body: { name: string; description: string; price: number; basis: PackageBasis; chargeType: PackageChargeType; roomTypeIds: string[]; showOnline: boolean; isActive?: boolean }) => Promise<unknown>;
  saving: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState(pkg?.name ?? '');
  const [description, setDescription] = useState(pkg?.description ?? '');
  const [price, setPrice] = useState(pkg?.price ?? '');
  const [basis, setBasis] = useState<string | null>(pkg?.basis ?? 'per_night');
  const [chargeType, setChargeType] = useState<string | null>(pkg?.chargeType ?? 'fnb');
  const [roomTypeIds, setRoomTypeIds] = useState<string[]>(pkg?.roomTypeIds ?? []);
  const [showOnline, setShowOnline] = useState(pkg?.showOnline ?? true);
  const [isActive, setIsActive] = useState(pkg?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        price: Number(price),
        basis: (basis ?? 'per_night') as PackageBasis,
        chargeType: (chargeType ?? 'fnb') as PackageChargeType,
        roomTypeIds,
        showOnline,
        ...(pkg ? { isActive } : {}),
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <Modal open onClose={onClose} title={pkg ? `Edit ${pkg.name}` : 'Add Package'}>
      <Input id="package-name" label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="Breakfast for two" />
      <Textarea id="package-description" label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} hint="Shown to guests online" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
        <Input id="package-price" label={`Price (${currencySymbol}, before tax)`} type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
        <Select id="package-basis" label="Priced" options={BASIS_OPTIONS} value={basis} onChange={setBasis} />
        <Select id="package-charge-type" label="Posts to the bill as" options={CHARGE_OPTIONS} value={chargeType} onChange={setChargeType} hint="How it's taxed and reported" />
      </div>
      <MultiSelectTagInput
        id="package-room-types"
        label="Room types (optional)"
        options={roomTypes.map((rt) => ({ value: rt.id, label: rt.name }))}
        value={roomTypeIds}
        onChange={setRoomTypeIds}
        hint="Leave empty for every room type."
      />
      <YesNoToggle label="Offer it on the booking page" name="packageOnline" value={showOnline ? 'yes' : 'no'} onChange={(v) => setShowOnline(v === 'yes')} />
      {pkg ? <YesNoToggle label="On sale" name="packageActive" value={isActive ? 'yes' : 'no'} onChange={(v) => setIsActive(v === 'yes')} /> : null}
      {error ? <p className="text-small text-red-600">{error}</p> : null}
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={save} loading={saving} disabled={name.trim().length < 2 || !(Number(price) >= 0) || price === ''}>
          {pkg ? 'Save Changes' : 'Add Package'}
        </Button>
      </div>
    </Modal>
  );
}
