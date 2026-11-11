import React, { useMemo, useState } from 'react';
import { api } from '../../services/api';
import type { Grade } from '../../services/admin-types';
import { useAsyncList, messageOf } from '../../components/setup/useAsyncList';
import { Card, Check, Confirm, Field, FormModal, LinkButton, ListState, matchesStatus, StatusBadge, Td, TextInput, Th, Toolbar } from '../../components/setup/ui';

const GradeForm: React.FC<{ grade: Grade | null; onDone: () => void; onCancel: () => void }> = ({ grade, onDone, onCancel }) => {
  const [code, setCode] = useState(grade?.code ?? '');
  const [name, setName] = useState(grade?.name ?? '');
  const [isActive, setIsActive] = useState(grade?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const codeProblem = code.trim() === '' ? 'The code is required.' : /^[A-Za-z0-9._-]+$/.test(code.trim()) ? '' : 'Use letters, numbers, dot, dash or underscore only.';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const input = { code, name, isActive };
      if (grade) await api.admin.updateGrade(grade.id, input);
      else await api.admin.createGrade(input);
      onDone();
    } catch (err: unknown) {
      setError(messageOf(err, 'Could not save the grade.'));
      setSaving(false);
    }
  };

  return (
    <FormModal title={grade ? 'Edit grade' : 'Create grade'} onClose={onCancel} onSubmit={submit} saving={saving} error={error} size="sm" canSave={!codeProblem} blockedReason={codeProblem}>
      <div className="space-y-3">
        <Field label="Code" hint="You choose the code, for example G15." error={codeProblem}>
          {(id) => <TextInput id={id} value={code} onChange={(e) => setCode(e.target.value)} maxLength={20} aria-invalid={Boolean(codeProblem)} />}
        </Field>
        <Field label="Name (optional)">{(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />}</Field>
        <Check label="Active" checked={isActive} onChange={setIsActive} />
      </div>
    </FormModal>
  );
};

export const GradesTab: React.FC = () => {
  const { data, loading, error, reload } = useAsyncList(api.admin.listGrades);
  const [filter, setFilter] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active');
  const [editing, setEditing] = useState<Grade | 'new' | null>(null);
  const [removing, setRemoving] = useState<Grade | null>(null);
  const [busy, setBusy] = useState(false);
  const [removeError, setRemoveError] = useState('');

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return data.filter((g) => matchesStatus(g.isActive, status) && (!q || `${g.code} ${g.name ?? ''}`.toLowerCase().includes(q)));
  }, [data, filter, status]);

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    setRemoveError('');
    try {
      await api.admin.deleteGrade(removing.id);
      setRemoving(null);
      await reload();
    } catch (err: unknown) {
      setRemoveError(messageOf(err, 'Could not delete the grade.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <Toolbar filter={filter} onFilter={setFilter} placeholder="Filter grades…" status={status} onStatus={setStatus} addLabel="Add grade" onAdd={() => setEditing('new')} />
      <ListState loading={loading} error={error} onRetry={reload} empty={rows.length === 0} emptyText={data.length === 0 ? 'No grades yet. Add the first one.' : 'No grade matches the filter.'}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-800">
              <tr>
                <Th>Code</Th>
                <Th>Name</Th>
                <Th>Employees</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map((g) => (
                <tr key={g.id}>
                  <Td className="font-mono font-semibold">{g.code}</Td>
                  <Td>{g.name ?? '—'}</Td>
                  <Td>{g.employeeCount}</Td>
                  <Td><StatusBadge active={g.isActive} /></Td>
                  <Td>
                    <span className="flex gap-4">
                      <LinkButton onClick={() => setEditing(g)}>Edit</LinkButton>
                      <LinkButton danger onClick={() => { setRemoveError(''); setRemoving(g); }}>Delete</LinkButton>
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ListState>
      {editing && (
        <GradeForm grade={editing === 'new' ? null : editing} onCancel={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} />
      )}
      {removing && (
        <Confirm title="Delete grade" message={`Delete grade ${removing.code}? This cannot be undone. A grade that employees use cannot be deleted; make it inactive instead.`} confirmLabel="Delete" busy={busy} error={removeError} onConfirm={remove} onCancel={() => setRemoving(null)} />
      )}
    </Card>
  );
};
