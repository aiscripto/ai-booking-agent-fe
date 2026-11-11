import React, { useMemo, useState } from 'react';
import { api } from '../../services/api';
import type { ServiceCategoryRow } from '../../services/admin-types';
import { useAsyncList, messageOf } from '../../components/setup/useAsyncList';
import { Card, Check, Confirm, Field, FormModal, LinkButton, ListState, matchesStatus, StatusBadge, Td, TextArea, TextInput, Th, Toolbar } from '../../components/setup/ui';

const CategoryForm: React.FC<{ category: ServiceCategoryRow | null; onDone: () => void; onCancel: () => void }> = ({ category, onDone, onCancel }) => {
  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [isActive, setIsActive] = useState(category?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const nameProblem = name.trim() === '' ? 'The name is required.' : '';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const input = { name, description, isActive };
      if (category) await api.admin.updateCategory(category.id, input);
      else await api.admin.createCategory(input);
      onDone();
    } catch (err: unknown) {
      setError(messageOf(err, 'Could not save the service category.'));
      setSaving(false);
    }
  };

  return (
    <FormModal title={category ? 'Edit service category' : 'Create service category'} onClose={onCancel} onSubmit={submit} saving={saving} error={error} size="md" canSave={!nameProblem} blockedReason={nameProblem}>
      <div className="space-y-3">
        <Field label="Name" hint="What a caller asks for, for example Dentist or Tax advice." error={nameProblem}>
          {(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-invalid={Boolean(nameProblem)} />}
        </Field>
        <Field label="Description (optional)">{(id) => <TextArea id={id} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />}</Field>
        <Check label="Active" checked={isActive} onChange={setIsActive} />
      </div>
    </FormModal>
  );
};

export const CategoriesTab: React.FC = () => {
  const { data, loading, error, reload } = useAsyncList(api.admin.listCategories);
  const [filter, setFilter] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active');
  const [editing, setEditing] = useState<ServiceCategoryRow | 'new' | null>(null);
  const [removing, setRemoving] = useState<ServiceCategoryRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [removeError, setRemoveError] = useState('');

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return data.filter((c) => matchesStatus(c.isActive, status) && (!q || `${c.name} ${c.description ?? ''}`.toLowerCase().includes(q)));
  }, [data, filter, status]);

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    setRemoveError('');
    try {
      await api.admin.deleteCategory(removing.id);
      setRemoving(null);
      await reload();
    } catch (err: unknown) {
      setRemoveError(messageOf(err, 'Could not delete the service category.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <Toolbar filter={filter} onFilter={setFilter} placeholder="Filter service categories…" status={status} onStatus={setStatus} addLabel="Add category" onAdd={() => setEditing('new')} />
      <ListState loading={loading} error={error} onRetry={reload} empty={rows.length === 0} emptyText={data.length === 0 ? 'No service categories yet. Add what callers can book, then choose them on each consultant.' : 'No category matches the filter.'}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-800">
              <tr>
                <Th>Name</Th>
                <Th>Description</Th>
                <Th>Consultants</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map((c) => (
                <tr key={c.id}>
                  <Td className="font-semibold">{c.name}</Td>
                  <Td className="max-w-xs">{c.description ?? '—'}</Td>
                  <Td>{c.consultantCount}</Td>
                  <Td><StatusBadge active={c.isActive} /></Td>
                  <Td>
                    <span className="flex gap-4">
                      <LinkButton onClick={() => setEditing(c)}>Edit</LinkButton>
                      <LinkButton danger onClick={() => { setRemoveError(''); setRemoving(c); }}>Delete</LinkButton>
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ListState>
      {editing && <CategoryForm category={editing === 'new' ? null : editing} onCancel={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} />}
      {removing && (
        <Confirm title="Delete service category" message={`Delete ${removing.name}? Old appointments keep their record. A category that consultants offer cannot be deleted; make it inactive instead.`} confirmLabel="Delete" busy={busy} error={removeError} onConfirm={remove} onCancel={() => setRemoving(null)} />
      )}
    </Card>
  );
};
