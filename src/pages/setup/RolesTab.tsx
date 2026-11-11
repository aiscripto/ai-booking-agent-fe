import React, { useMemo, useState } from 'react';
import { api } from '../../services/api';
import type { RoleRow } from '../../services/admin-types';
import { useAsyncList, messageOf } from '../../components/setup/useAsyncList';
import { Card, Check, Confirm, Field, FormActions, LinkButton, ListState, matchesStatus, Modal, StatusBadge, Td, TextArea, TextInput, Th, Toolbar } from '../../components/setup/ui';

const RoleForm: React.FC<{ role: RoleRow | null; onDone: () => void; onCancel: () => void }> = ({ role, onDone, onCancel }) => {
  const permissions = useAsyncList(api.admin.listPermissions);
  const [name, setName] = useState(role?.name ?? '');
  const [code, setCode] = useState(role?.code ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [granted, setGranted] = useState<string[]>(role?.permissions ?? []);
  const [isActive, setIsActive] = useState(role?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isAdmin = role?.isSystem === true && role.code === 'ADMIN';
  const toggle = (permission: string, on: boolean) =>
    setGranted((list) => (on ? [...new Set([...list, permission])] : list.filter((p) => p !== permission)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const input = { code, name, description, permissions: granted, isActive };
      if (role) await api.admin.updateRole(role.id, input);
      else await api.admin.createRole(input);
      onDone();
    } catch (err: unknown) {
      setError(messageOf(err, 'Could not save the role.'));
      setSaving(false);
    }
  };

  return (
    <Modal title={role ? 'Edit role' : 'Create role'} onClose={onCancel} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Role">{(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />}</Field>
          <Field label="Code" hint={role?.isSystem ? 'The code of a built-in role cannot change.' : 'Capital letters, numbers and underscore, for example LINE_MANAGER.'}>
            {(id) => <TextInput id={id} value={code} onChange={(e) => setCode(e.target.value)} required maxLength={40} readOnly={role?.isSystem === true} disabled={role?.isSystem === true} />}
          </Field>
        </div>
        <Field label="Description">{(id) => <TextArea id={id} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />}</Field>

        <fieldset className="border border-slate-800 rounded-xl p-4">
          <legend className="px-2 text-[11px] font-bold uppercase tracking-wider text-slate-300">Permissions</legend>
          {isAdmin && <p className="text-xs text-slate-400 mb-3">The Admin role always has every permission, so nobody can be locked out.</p>}
          {permissions.loading && <p role="status" className="text-sm text-slate-400">Loading permissions…</p>}
          {permissions.error && (
            <p role="alert" className="text-sm text-rose-300">
              {permissions.error}{' '}
              <button type="button" onClick={permissions.reload} className="underline">Try again</button>
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {permissions.data.map((p) => (
              <div key={p.code}>
                <Check label={p.label} checked={isAdmin || granted.includes(p.code)} disabled={isAdmin} onChange={(on) => toggle(p.code, on)} />
                <p className="text-xs text-slate-400 ml-6">{p.description}</p>
              </div>
            ))}
          </div>
        </fieldset>

        <Check label="Active" checked={isActive} onChange={setIsActive} disabled={isAdmin} />
        <FormActions saving={saving} error={error} onCancel={onCancel} />
      </form>
    </Modal>
  );
};

export const RolesTab: React.FC = () => {
  const { data, loading, error, reload } = useAsyncList(api.admin.listRoles);
  const [filter, setFilter] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active');
  const [editing, setEditing] = useState<RoleRow | 'new' | null>(null);
  const [removing, setRemoving] = useState<RoleRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [removeError, setRemoveError] = useState('');

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return data.filter((r) => matchesStatus(r.isActive, status) && (!q || `${r.name} ${r.code} ${r.description ?? ''}`.toLowerCase().includes(q)));
  }, [data, filter, status]);

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    setRemoveError('');
    try {
      await api.admin.deleteRole(removing.id);
      setRemoving(null);
      await reload();
    } catch (err: unknown) {
      setRemoveError(messageOf(err, 'Could not delete the role.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <Toolbar filter={filter} onFilter={setFilter} placeholder="Filter roles…" status={status} onStatus={setStatus} addLabel="Add role" onAdd={() => setEditing('new')} />
      <ListState loading={loading} error={error} onRetry={reload} empty={rows.length === 0} emptyText="No role matches the filter.">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-800">
              <tr>
                <Th>Role</Th>
                <Th>Code</Th>
                <Th>Description</Th>
                <Th>Permissions</Th>
                <Th>Users</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map((r) => (
                <tr key={r.id}>
                  <Td className="font-semibold">
                    {r.name}
                    {r.isSystem && <span className="ml-2 text-[10px] uppercase tracking-wider text-slate-400 border border-slate-700 rounded px-1.5 py-0.5">Built-in</span>}
                  </Td>
                  <Td className="font-mono text-xs">{r.code}</Td>
                  <Td className="max-w-xs">{r.description ?? '—'}</Td>
                  <Td>{r.permissions.length} permissions</Td>
                  <Td>{r.userCount}</Td>
                  <Td><StatusBadge active={r.isActive} /></Td>
                  <Td>
                    <span className="flex gap-4">
                      <LinkButton onClick={() => setEditing(r)}>Edit</LinkButton>
                      {!r.isSystem && <LinkButton danger onClick={() => { setRemoveError(''); setRemoving(r); }}>Delete</LinkButton>}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ListState>
      {editing && <RoleForm role={editing === 'new' ? null : editing} onCancel={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} />}
      {removing && (
        <Confirm title="Delete role" message={`Delete the role ${removing.name}? A role that users or employees have cannot be deleted.`} confirmLabel="Delete" busy={busy} error={removeError} onConfirm={remove} onCancel={() => setRemoving(null)} />
      )}
    </Card>
  );
};
