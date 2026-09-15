'use client';

import { useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { MenuManagementIcon } from '@/components/ui/Icons';
import { ApiError } from '@/lib/api';
import { currencySymbolFor } from '@/lib/currencies';
import { formatMoney } from '@/lib/numberFormat';
import {
  OUTLET_CATEGORY_LABELS,
  useCreateOutletMutation,
  useDeleteMenuItemMutation,
  useOutletMenuQuery,
  useOutletsQuery,
  useSaveMenuItemMutation,
  useSetAvailabilityMutation,
  useSetStaffOutletsMutation,
  useUpdateOutletMutation,
  type MenuItem,
  type ModifierGroup,
  type Outlet,
  type OutletCategory,
} from '@/lib/pos';
import { isSupervisorAtBranch } from '@/lib/roles';
import { useStaffQuery } from '@/lib/staff';
import { useAuthStore } from '@/lib/store/authStore';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

const CATEGORY_OPTIONS: SelectOption[] = (Object.keys(OUTLET_CATEGORY_LABELS) as OutletCategory[]).map((value) => ({
  value,
  label: OUTLET_CATEGORY_LABELS[value],
}));

const SELECTION_OPTIONS: SelectOption[] = [
  { value: 'single', label: 'One option' },
  { value: 'multi', label: 'Any number' },
];

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

function describeChoices(groups: ModifierGroup[]): string {
  return groups.map((group) => `${group.name}: ${group.options.map((option) => option.label).join(' / ')}`).join(' · ');
}

export default function MenuManagementPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  if (!activeBranchId) return null;
  const supervisor = isSupervisorAtBranch(user, activeBranchId);

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader
        icon={<MenuManagementIcon className="size-8" />}
        title="Menu Management"
        subtitle="Each outlet's menu, prices and choices — and what's 86'd right now."
        roles="Manager · F&B Staff"
      />
      {supervisor ? <OutletsSection branchId={activeBranchId} auth={auth} /> : null}
      <MenuSection branchId={activeBranchId} supervisor={supervisor} auth={auth} />
    </Container>
  );
}

// --- Outlets (managers) ---------------------------------------------------------

function OutletsSection({ branchId, auth }: { branchId: string; auth: AuthOpts }) {
  const outletsQuery = useOutletsQuery(branchId, auth);
  const createMutation = useCreateOutletMutation(branchId, auth);
  const updateMutation = useUpdateOutletMutation(branchId, auth);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<Outlet | null>(null);
  const [staffing, setStaffing] = useState<Outlet | null>(null);
  const outlets = outletsQuery.data ?? [];

  async function addOutlet() {
    if (!category) return;
    setAddError(null);
    try {
      await createMutation.mutateAsync({ name: name.trim(), category: category as OutletCategory });
      setName('');
      setCategory(null);
    } catch (err) {
      setAddError(errorText(err, "Couldn't add the outlet."));
    }
  }

  async function toggleActive(outlet: Outlet) {
    setListError(null);
    try {
      await updateMutation.mutateAsync({ outletId: outlet.id, isActive: !outlet.isActive });
    } catch (err) {
      setListError(errorText(err, "Couldn't update the outlet."));
    }
  }

  return (
    <Section label="Outlets">
      <p className="text-small text-secondary-light">
        An outlet&apos;s type decides how its sales show on a guest&apos;s bill and in revenue reports — food &amp; beverage, spa, laundry or other — so it
        can&apos;t be changed later. Front desk and managers can ring up at every outlet; POS staff only at the ones they&apos;re assigned to.
      </p>
      {outletsQuery.isSuccess && outlets.length === 0 ? <p className="text-body text-primary-dark/70">No outlets yet — add the first one below.</p> : null}
      {listError ? <p className="text-small text-red-600">{listError}</p> : null}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {outlets.map((outlet) => (
          <Card key={outlet.id} className={`flex flex-col gap-2 ${outlet.isActive ? '' : 'opacity-70'}`}>
            <div>
              <p className="text-body font-semibold text-secondary">{outlet.name}</p>
              <p className="text-small text-secondary-light">
                {OUTLET_CATEGORY_LABELS[outlet.category]} · {outlet.menuItemCount} {outlet.menuItemCount === 1 ? 'item' : 'items'}
                {outlet.isActive ? '' : ' · Inactive'}
              </p>
            </div>
            <p className="text-small text-secondary">
              POS staff: {outlet.assignedStaff && outlet.assignedStaff.length > 0 ? outlet.assignedStaff.map((s) => s.name).join(', ') : 'none assigned'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setRenaming(outlet)}>
                Rename
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setStaffing(outlet)}>
                Assign staff
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => toggleActive(outlet)}
                loading={updateMutation.isPending && updateMutation.variables.outletId === outlet.id}
              >
                {outlet.isActive ? 'Deactivate' : 'Reactivate'}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Card tone="primary" className="flex flex-col gap-2">
        <p className="text-body font-semibold text-secondary">Add an outlet</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input name="outletName" label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Poolside Bar" maxLength={150} />
          <Select name="outletCategory" label="Type" options={CATEGORY_OPTIONS} value={category} onChange={setCategory} />
        </div>
        {addError ? <p className="text-small text-red-600">{addError}</p> : null}
        <div>
          <Button type="button" onClick={addOutlet} loading={createMutation.isPending} disabled={!name.trim() || !category}>
            Add outlet
          </Button>
        </div>
      </Card>

      {renaming ? <RenameOutletDialog key={renaming.id} outlet={renaming} branchId={branchId} auth={auth} onClose={() => setRenaming(null)} /> : null}
      {staffing ? <AssignStaffDialog key={staffing.id} outlet={staffing} branchId={branchId} auth={auth} onClose={() => setStaffing(null)} /> : null}
    </Section>
  );
}

function RenameOutletDialog({ outlet, branchId, auth, onClose }: { outlet: Outlet; branchId: string; auth: AuthOpts; onClose: () => void }) {
  const mutation = useUpdateOutletMutation(branchId, auth);
  const [name, setName] = useState(outlet.name);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    try {
      await mutation.mutateAsync({ outletId: outlet.id, name: name.trim() });
      onClose();
    } catch (err) {
      setError(errorText(err, "Couldn't rename the outlet."));
    }
  }

  return (
    <Modal open onClose={onClose} title={`Rename ${outlet.name}`}>
      <Input name="renameOutlet" label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={150} />
      {error ? <p className="text-small text-red-600">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={save} loading={mutation.isPending} disabled={!name.trim() || name.trim() === outlet.name}>
          Save
        </Button>
      </div>
    </Modal>
  );
}

/**
 * Assignments are stored per staff member (the Users module's
 * `PUT /users/:id/outlets` replaces one person's outlets at the branch), so
 * saving here sends one update for each person whose tick changed.
 */
function AssignStaffDialog({ outlet, branchId, auth, onClose }: { outlet: Outlet; branchId: string; auth: AuthOpts; onClose: () => void }) {
  const staffQuery = useStaffQuery(branchId, auth);
  const mutation = useSetStaffOutletsMutation(branchId, auth);
  const [changed, setChanged] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const posStaff = (staffQuery.data ?? []).filter(
    (member) => member.active && member.roles.some((r) => r.role === 'pos_staff' && (r.branchId === null || r.branchId === branchId)),
  );
  const isTicked = (memberId: string, outletIds: string[]) => changed[memberId] ?? outletIds.includes(outlet.id);

  async function save() {
    setError(null);
    try {
      for (const member of posStaff) {
        const was = member.outletIds.includes(outlet.id);
        const now = isTicked(member.id, member.outletIds);
        if (was === now) continue;
        const outletIds = now ? [...member.outletIds, outlet.id] : member.outletIds.filter((id) => id !== outlet.id);
        await mutation.mutateAsync({ userId: member.id, outletIds });
      }
      onClose();
    } catch (err) {
      setError(errorText(err, "Couldn't save the assignments."));
    }
  }

  return (
    <Modal open onClose={onClose} title={`Staff at ${outlet.name}`}>
      {staffQuery.isLoading ? <p className="text-body text-primary-dark/70">Loading staff…</p> : null}
      {staffQuery.isSuccess && posStaff.length === 0 ? (
        <p className="text-body text-secondary">No one at this branch has the POS staff role yet — give it to them in Staff Management first.</p>
      ) : null}
      <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto">
        {posStaff.map((member) => (
          <label key={member.id} className="flex items-center gap-3 rounded-control border border-secondary/20 px-3 py-2 cursor-pointer hover:bg-secondary/5">
            <input
              type="checkbox"
              checked={isTicked(member.id, member.outletIds)}
              onChange={(e) => setChanged((current) => ({ ...current, [member.id]: e.target.checked }))}
              className="size-4 accent-secondary"
            />
            <span className="text-body text-secondary">{member.name}</span>
            <span className="text-small text-secondary-light">{member.email}</span>
          </label>
        ))}
      </div>
      {error ? <p className="text-small text-red-600">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={save} loading={mutation.isPending} disabled={posStaff.length === 0}>
          Save
        </Button>
      </div>
    </Modal>
  );
}

// --- Menu -------------------------------------------------------------------------

function MenuSection({ branchId, supervisor, auth }: { branchId: string; supervisor: boolean; auth: AuthOpts }) {
  const outletsQuery = useOutletsQuery(branchId, auth);
  const outlets = outletsQuery.data ?? [];
  const [chosenOutletId, setChosenOutletId] = useState<string | null>(null);
  const outletId = chosenOutletId && outlets.some((o) => o.id === chosenOutletId) ? chosenOutletId : (outlets[0]?.id ?? null);

  return (
    <Section label="Menu">
      {outletsQuery.isError ? <p className="text-body text-red-600">{errorText(outletsQuery.error, "Couldn't load the outlets.")}</p> : null}
      {outletsQuery.isSuccess && outlets.length === 0 ? (
        <p className="text-body text-primary-dark/70">{supervisor ? 'Add an outlet above to start its menu.' : 'You aren’t assigned to an outlet yet.'}</p>
      ) : null}
      {outlets.length > 1 ? (
        <div className="max-w-sm">
          <Select
            name="menuOutlet"
            label="Outlet"
            options={outlets.map((o) => ({ value: o.id, label: `${o.name} · ${OUTLET_CATEGORY_LABELS[o.category]}` }))}
            value={outletId}
            onChange={setChosenOutletId}
          />
        </div>
      ) : null}
      {outletId ? <OutletMenuEditor key={outletId} outletId={outletId} supervisor={supervisor} auth={auth} /> : null}
    </Section>
  );
}

function OutletMenuEditor({ outletId, supervisor, auth }: { outletId: string; supervisor: boolean; auth: AuthOpts }) {
  const menuQuery = useOutletMenuQuery(outletId, auth);
  const availability = useSetAvailabilityMutation(outletId, auth);
  const removal = useDeleteMenuItemMutation(outletId, auth);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [removing, setRemoving] = useState<MenuItem | null>(null);
  const [addFormKey, setAddFormKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const menu = menuQuery.data;
  const symbol = currencySymbolFor(menu?.currency);
  const items = menu?.items ?? [];
  const categories = [...new Set(items.map((item) => item.category))];

  async function toggleAvailability(item: MenuItem) {
    setError(null);
    try {
      await availability.mutateAsync({ itemId: item.id, isAvailable: !item.isAvailable });
    } catch (err) {
      setError(errorText(err, "Couldn't change the item's availability."));
    }
  }

  async function remove(item: MenuItem) {
    setError(null);
    try {
      await removal.mutateAsync(item.id);
      setRemoving(null);
    } catch (err) {
      setError(errorText(err, "Couldn't remove the item."));
      setRemoving(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {menuQuery.isLoading ? <p className="text-body text-primary-dark/70">Loading the menu…</p> : null}
      {menu && items.length === 0 ? <p className="text-body text-primary-dark/70">Nothing on {menu.outlet.name}&apos;s menu yet.</p> : null}
      {error ? <p className="text-small text-red-600">{error}</p> : null}

      {categories.map((category) => (
        <div key={category} className="flex flex-col gap-2">
          <h3 className="text-small font-bold uppercase tracking-wide text-secondary-light">{category}</h3>
          <ul className="flex flex-col gap-2">
            {items
              .filter((item) => item.category === category)
              .map((item) => (
                <li key={item.id}>
                  <Card className={`flex flex-wrap items-center justify-between gap-3 ${item.isAvailable ? '' : 'opacity-80'}`}>
                    <div className="min-w-0">
                      <p className="text-body font-semibold text-secondary">
                        {item.name} <span className="font-normal text-secondary-light">{formatMoney(item.price, symbol)}</span>
                        {item.isAvailable ? null : <span className="ml-2 rounded-pill bg-red-100 px-2 py-0.5 text-tiny font-semibold text-red-800">86&apos;d</span>}
                      </p>
                      {item.modifiers && item.modifiers.length > 0 ? <p className="text-tiny text-secondary-light">{describeChoices(item.modifiers)}</p> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => toggleAvailability(item)}
                        loading={availability.isPending && availability.variables.itemId === item.id}
                      >
                        {item.isAvailable ? "86 it" : 'Back on'}
                      </Button>
                      {supervisor ? (
                        <>
                          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(item)}>
                            Edit
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => setRemoving(item)}>
                            Remove
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </Card>
                </li>
              ))}
          </ul>
        </div>
      ))}

      {supervisor ? (
        <Card tone="primary" className="flex flex-col gap-3">
          <p className="text-body font-semibold text-secondary">Add an item</p>
          <MenuItemForm key={addFormKey} idPrefix="new-item" outletId={outletId} categories={categories} auth={auth} onSaved={() => setAddFormKey((k) => k + 1)} />
        </Card>
      ) : null}

      {editing ? (
        <Modal open onClose={() => setEditing(null)} title={`Edit ${editing.name}`}>
          <div className="max-h-[70vh] overflow-y-auto">
            <MenuItemForm idPrefix={`edit-${editing.id}`} outletId={outletId} item={editing} categories={categories} auth={auth} onSaved={() => setEditing(null)} />
          </div>
        </Modal>
      ) : null}

      {removing ? (
        <Modal open onClose={() => setRemoving(null)} title={`Remove ${removing.name}?`}>
          <p className="text-body text-secondary">It comes off the menu for good. Past orders keep their own record of it, price and all.</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setRemoving(null)}>
              Keep it
            </Button>
            <Button type="button" variant="danger" onClick={() => remove(removing)} loading={removal.isPending}>
              Remove
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

type OptionDraft = { label: string; price: string };
type GroupDraft = { name: string; selection: 'single' | 'multi'; required: boolean; options: OptionDraft[] };

function MenuItemForm({
  idPrefix,
  outletId,
  item,
  categories,
  auth,
  onSaved,
}: {
  idPrefix: string;
  outletId: string;
  item?: MenuItem;
  categories: string[];
  auth: AuthOpts;
  onSaved: () => void;
}) {
  const mutation = useSaveMenuItemMutation(outletId, auth);
  const [name, setName] = useState(item?.name ?? '');
  const [category, setCategory] = useState(item?.category ?? '');
  const [price, setPrice] = useState(item ? String(Number(item.price)) : '');
  const [groups, setGroups] = useState<GroupDraft[]>(() =>
    (item?.modifiers ?? []).map((group) => ({ ...group, options: group.options.map((option) => ({ label: option.label, price: String(option.price) })) })),
  );
  const [error, setError] = useState<string | null>(null);
  const listId = `${idPrefix}-categories`;

  async function save() {
    setError(null);
    const priceValue = Number(price);
    if (!name.trim() || !category.trim() || price.trim() === '' || !Number.isFinite(priceValue) || priceValue < 0) {
      setError('Give the item a name, a category and a price of 0 or more.');
      return;
    }
    const modifiers: ModifierGroup[] = groups.map((group) => ({
      name: group.name.trim(),
      selection: group.selection,
      required: group.required,
      options: group.options
        .filter((option) => option.label.trim())
        .map((option) => ({ label: option.label.trim(), price: option.price.trim() === '' ? 0 : Number(option.price) })),
    }));
    if (modifiers.some((group) => !group.name || group.options.length === 0 || group.options.some((o) => !Number.isFinite(o.price) || o.price < 0))) {
      setError('Every choice needs a name and at least one option, each adding 0 or more.');
      return;
    }
    try {
      await mutation.mutateAsync({ itemId: item?.id, name: name.trim(), category: category.trim(), price: priceValue, modifiers });
      onSaved();
    } catch (err) {
      setError(errorText(err, "Couldn't save the item."));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Input name={`${idPrefix}-name`} label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Chapman" maxLength={150} />
        <Input
          name={`${idPrefix}-category`}
          label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Drinks"
          list={listId}
          maxLength={60}
          hint="The terminal's tabs. Pick an existing one or type a new one."
        />
        <Input
          name={`${idPrefix}-price`}
          label="Price (before tax)"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </div>
      <datalist id={listId}>
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <ModifierBuilder idPrefix={idPrefix} groups={groups} onChange={setGroups} />
      {error ? <p className="text-small text-red-600">{error}</p> : null}
      <div>
        <Button type="button" onClick={save} loading={mutation.isPending}>
          {item ? 'Save changes' : 'Add item'}
        </Button>
      </div>
    </div>
  );
}

/** Choices a guest makes on an item — a size, a doneness, extras — each option with the amount it adds. */
function ModifierBuilder({ idPrefix, groups, onChange }: { idPrefix: string; groups: GroupDraft[]; onChange: (groups: GroupDraft[]) => void }) {
  const setGroup = (index: number, patch: Partial<GroupDraft>) => onChange(groups.map((group, i) => (i === index ? { ...group, ...patch } : group)));
  const setOption = (groupIndex: number, optionIndex: number, patch: Partial<OptionDraft>) =>
    setGroup(groupIndex, { options: (groups[groupIndex]?.options ?? []).map((option, i) => (i === optionIndex ? { ...option, ...patch } : option)) });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-small font-semibold text-secondary">Choices</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange([...groups, { name: '', selection: 'single', required: false, options: [{ label: '', price: '0' }] }])}
        >
          Add a choice
        </Button>
      </div>
      {groups.length === 0 ? <p className="text-tiny text-secondary-light">None. Add one for a size, a doneness or extras — each option can add to the price.</p> : null}
      {groups.map((group, gi) => (
        <Card key={gi} className="flex flex-col gap-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <Input name={`${idPrefix}-group-${gi}`} label="Choice" value={group.name} onChange={(e) => setGroup(gi, { name: e.target.value })} placeholder="Doneness" maxLength={60} />
            <Select
              name={`${idPrefix}-group-${gi}-selection`}
              label="Guest picks"
              options={SELECTION_OPTIONS}
              value={group.selection}
              onChange={(value) => setGroup(gi, { selection: value === 'multi' ? 'multi' : 'single' })}
            />
            <label className="flex items-center gap-2 pb-3 text-small text-secondary cursor-pointer">
              <input type="checkbox" checked={group.required} onChange={(e) => setGroup(gi, { required: e.target.checked })} className="size-4 accent-secondary" />
              Required
            </label>
          </div>
          {group.options.map((option, oi) => (
            <div key={oi} className="grid grid-cols-[1fr_7rem_auto] gap-3 items-end">
              <Input
                name={`${idPrefix}-group-${gi}-option-${oi}`}
                label="Option"
                value={option.label}
                onChange={(e) => setOption(gi, oi, { label: e.target.value })}
                placeholder="Medium rare"
                maxLength={60}
              />
              <Input
                name={`${idPrefix}-group-${gi}-option-${oi}-price`}
                label="Adds"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={option.price}
                onChange={(e) => setOption(gi, oi, { price: e.target.value })}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label={`Remove option ${option.label || oi + 1}`}
                onClick={() => setGroup(gi, { options: group.options.filter((_, i) => i !== oi) })}
                disabled={group.options.length === 1}
                className="mb-2"
              >
                Remove
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setGroup(gi, { options: [...group.options, { label: '', price: '0' }] })}>
              Add option
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => onChange(groups.filter((_, i) => i !== gi))}>
              Remove choice
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
