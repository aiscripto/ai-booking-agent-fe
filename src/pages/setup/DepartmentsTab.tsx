import React, { useMemo, useState } from 'react';
import { api } from '../../services/api';
import type { DepartmentRow } from '../../services/admin-types';
import { emailProblem } from '../../services/geo';
import { useAsyncList, messageOf } from '../../components/setup/useAsyncList';
import { Card, Check, Confirm, Field, FormModal, LinkButton, ListState, matchesStatus, StatusBadge, Td, TextArea, TextInput, Th, Toolbar } from '../../components/setup/ui';

const DepartmentForm: React.FC<{ department: DepartmentRow | null; onDone: () => void; onCancel: () => void }> = ({ department, onDone, onCancel }) => {
  const [name, setName] = useState(department?.name ?? '');
  const [description, setDescription] = useState(department?.description ?? '');
  const [location, setLocation] = useState(department?.location ?? '');
  const [contact, setContact] = useState(department?.contact ?? '');
  const [email, setEmail] = useState(department?.email ?? '');
  const [isActive, setIsActive] = useState(department?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const input = { name, description, location, contact, email, isActive };
      if (department) await api.admin.updateDepartment(department.id, input);
      else await api.admin.createDepartment(input);
      onDone();
    } catch (err: unknown) {
      setError(messageOf(err, 'Could not save the department.'));
      setSaving(false);
    }
  };

  return (
    <FormModal title={department ? 'Edit department' : 'Create department'} onClose={onCancel} onSubmit={submit} saving={saving} error={error} size="lg" canSave={name.trim() !== '' && !emailProblem(email)} blockedReason={name.trim() === '' ? 'The name is required.' : emailProblem(email)}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-3">
        <Field label="Name" className="sm:col-span-2">{(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} aria-invalid={name.trim() === ''} />}</Field>
        <div className="flex items-end pb-1.5"><Check label="Active" checked={isActive} onChange={setIsActive} /></div>
        <Field label="Location">{(id) => <TextInput id={id} value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} />}</Field>
        <Field label="Contact">{(id) => <TextInput id={id} value={contact} onChange={(e) => setContact(e.target.value)} maxLength={120} />}</Field>
        <Field label="Email" error={emailProblem(email)}>{(id) => <TextInput id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} aria-invalid={Boolean(emailProblem(email))} />}</Field>
        <Field label="Description" className="sm:col-span-3">{(id) => <TextArea id={id} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />}</Field>
      </div>
    </FormModal>
  );
};

export const DepartmentsTab: React.FC = () => {
  const { data, loading, error, reload } = useAsyncList(api.admin.listDepartments);
  const [filter, setFilter] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active');
  const [editing, setEditing] = useState<DepartmentRow | 'new' | null>(null);
  const [removing, setRemoving] = useState<DepartmentRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [removeError, setRemoveError] = useState('');

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return data.filter((d) => matchesStatus(d.isActive, status) && (!q || `${d.name} ${d.description ?? ''} ${d.location ?? ''}`.toLowerCase().includes(q)));
  }, [data, filter, status]);

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    setRemoveError('');
    try {
      await api.admin.deleteDepartment(removing.id);
      setRemoving(null);
      await reload();
    } catch (err: unknown) {
      setRemoveError(messageOf(err, 'Could not delete the department.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <Toolbar filter={filter} onFilter={setFilter} placeholder="Filter departments…" status={status} onStatus={setStatus} addLabel="Add department" onAdd={() => setEditing('new')} />
      <ListState loading={loading} error={error} onRetry={reload} empty={rows.length === 0} emptyText={data.length === 0 ? 'No departments yet. Add the first one.' : 'No department matches the filter.'}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-800">
              <tr>
                <Th>Name</Th>
                <Th>Description</Th>
                <Th>Location</Th>
                <Th>Contact</Th>
                <Th>Employees</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map((d) => (
                <tr key={d.id}>
                  <Td className="font-semibold">{d.name}</Td>
                  <Td className="max-w-xs">{d.description ?? '—'}</Td>
                  <Td>{d.location ?? '—'}</Td>
                  <Td>{[d.contact, d.email].filter(Boolean).join(' · ') || '—'}</Td>
                  <Td>{d.employeeCount}</Td>
                  <Td><StatusBadge active={d.isActive} /></Td>
                  <Td>
                    <span className="flex gap-4">
                      <LinkButton onClick={() => setEditing(d)}>Edit</LinkButton>
                      <LinkButton danger onClick={() => { setRemoveError(''); setRemoving(d); }}>Delete</LinkButton>
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ListState>
      {editing && <DepartmentForm department={editing === 'new' ? null : editing} onCancel={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} />}
      {removing && (
        <Confirm
          title="Delete department"
          message={`Delete ${removing.name}? This cannot be undone. A department with employees or providers cannot be deleted; make it inactive instead.`}
          confirmLabel="Delete"
          busy={busy}
          error={removeError}
          onConfirm={remove}
          onCancel={() => setRemoving(null)}
        />
      )}
    </Card>
  );
};
