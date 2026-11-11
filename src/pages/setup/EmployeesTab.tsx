import React, { useCallback, useMemo, useState } from 'react';
import { api } from '../../services/api';
import type { EmployeeRow, WeeklyHours } from '../../services/admin-types';
import { useVocabulary } from '../../services/vocabulary';
import { HoursEditor } from '../../components/setup/HoursEditor';
import { useAsyncList, messageOf } from '../../components/setup/useAsyncList';
import { Button, Card, Check, Field, FormActions, LinkButton, ListState, matchesStatus, Modal, SelectInput, StatusBadge, Td, TextInput, Th, Toolbar } from '../../components/setup/ui';

interface Lookups {
  departments: Array<{ id: string; name: string }>;
  grades: Array<{ id: string; code: string }>;
  roles: Array<{ id: string; name: string }>;
  employees: EmployeeRow[];
  categories: Array<{ id: string; name: string }>;
  /** The business's own week, used as the starting point for a consultant's own hours. */
  businessWeek: WeeklyHours | null;
}

/** Whole days off for a consultant. Shown only for a saved consultant. */
const TimeOffPanel: React.FC<{ employeeId: string }> = ({ employeeId }) => {
  const fetchTimeOff = useCallback(() => api.admin.listTimeOff(employeeId), [employeeId]);
  const { data, loading, error, reload } = useAsyncList(fetchTimeOff);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const add = async () => {
    setSaving(true);
    setFormError('');
    try {
      await api.admin.addTimeOff(employeeId, { startDate, endDate: endDate || startDate, note });
      setStartDate('');
      setEndDate('');
      setNote('');
      await reload();
    } catch (err: unknown) {
      setFormError(messageOf(err, 'Could not add the days off.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setFormError('');
    try {
      await api.admin.deleteTimeOff(id);
      await reload();
    } catch (err: unknown) {
      setFormError(messageOf(err, 'Could not remove the days off.'));
    }
  };

  return (
    <div className="space-y-3">
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Days off</h4>
      {loading ? (
        <p role="status" className="text-sm text-slate-400">Loading…</p>
      ) : error ? (
        <p role="alert" className="text-sm text-rose-300">{error} <button type="button" onClick={reload} className="underline">Try again</button></p>
      ) : data.length === 0 ? (
        <p className="text-sm text-slate-400">No days off.</p>
      ) : (
        <ul className="divide-y divide-slate-800 border border-slate-800 rounded-lg">
          {data.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm text-slate-200">
              <span>
                {t.startDate.slice(0, 10)}{t.endDate.slice(0, 10) !== t.startDate.slice(0, 10) ? ` to ${t.endDate.slice(0, 10)}` : ''}
                {t.note ? <span className="text-slate-400"> · {t.note}</span> : null}
              </span>
              <button type="button" onClick={() => remove(t.id)} className="text-rose-400 hover:text-rose-300">Remove</button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
        <Field label="First day">{(id) => <TextInput id={id} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />}</Field>
        <Field label="Last day">{(id) => <TextInput id={id} type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />}</Field>
        <Field label="Note (optional)">{(id) => <TextInput id={id} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />}</Field>
        <Button kind="secondary" onClick={add} disabled={saving || !startDate}>{saving ? 'Adding…' : 'Add days off'}</Button>
      </div>
      {formError && <p role="alert" className="text-sm text-rose-300">{formError}</p>}
    </div>
  );
};

const EmployeeForm: React.FC<{ employee: EmployeeRow | null; lookups: Lookups; onDone: () => void; onCancel: () => void }> = ({ employee, lookups, onDone, onCancel }) => {
  const [fullName, setFullName] = useState(employee?.fullName ?? '');
  const [roleId, setRoleId] = useState(employee?.role?.id ?? '');
  const [departmentId, setDepartmentId] = useState(employee?.department?.id ?? '');
  const [email, setEmail] = useState(employee?.email ?? '');
  const [phone, setPhone] = useState(employee?.phone ?? '');
  const [gradeId, setGradeId] = useState(employee?.grade?.id ?? '');
  const [managerId, setManagerId] = useState(employee?.manager?.id ?? '');
  const [isActive, setIsActive] = useState(employee?.isActive ?? true);
  const [isBookable, setIsBookable] = useState(employee?.isBookable ?? false);
  const [title, setTitle] = useState(employee?.title ?? '');
  const [categoryIds, setCategoryIds] = useState<string[]>(employee?.categories.map((c) => c.id) ?? []);
  const [ownHours, setOwnHours] = useState<WeeklyHours | null>(employee?.workingHours ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const input = {
        fullName,
        email,
        phone,
        departmentId: departmentId || null,
        gradeId: gradeId || null,
        roleId: roleId || null,
        managerId: managerId || null,
        isActive,
        isBookable,
        title,
        categoryIds: isBookable ? categoryIds : [],
        workingHours: isBookable ? ownHours : null,
      };
      if (employee) await api.admin.updateEmployee(employee.id, input);
      else await api.admin.createEmployee(input);
      onDone();
    } catch (err: unknown) {
      setError(messageOf(err, 'Could not save the employee.'));
      setSaving(false);
    }
  };

  const managers = lookups.employees.filter((m) => m.isActive && m.id !== employee?.id);

  return (
    <Modal title={employee ? 'Edit employee' : 'Create employee'} onClose={onCancel} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Employee code" hint="Assigned by the system.">
            {(id) => <TextInput id={id} value={employee?.code ?? 'Assigned when you save'} readOnly disabled />}
          </Field>
          <Field label="Full name">{(id) => <TextInput id={id} value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={120} />}</Field>
          <Field label="Role">
            {(id) => (
              <SelectInput id={id} value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                <option value="">— None —</option>
                {lookups.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </SelectInput>
            )}
          </Field>
          <Field label="Department">
            {(id) => (
              <SelectInput id={id} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                <option value="">— None —</option>
                {lookups.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </SelectInput>
            )}
          </Field>
          <Field label="Email">{(id) => <TextInput id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} />}</Field>
          <Field label="Phone">{(id) => <TextInput id={id} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} />}</Field>
          <Field label="Grade">
            {(id) => (
              <SelectInput id={id} value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
                <option value="">— None —</option>
                {lookups.grades.map((g) => <option key={g.id} value={g.id}>{g.code}</option>)}
              </SelectInput>
            )}
          </Field>
          <Field label="Manager">
            {(id) => (
              <SelectInput id={id} value={managerId} onChange={(e) => setManagerId(e.target.value)}>
                <option value="">— No manager —</option>
                {managers.map((m) => <option key={m.id} value={m.id}>{m.fullName} ({m.code})</option>)}
              </SelectInput>
            )}
          </Field>
        </div>
        <fieldset className="border border-slate-800 rounded-xl p-4 space-y-4">
          <legend className="px-2 text-[11px] font-bold uppercase tracking-wider text-slate-300">Consultant</legend>
          <Check label="Takes appointments (callers and staff can book this person)" checked={isBookable} onChange={setIsBookable} />
          {isBookable && (
            <>
              <Field label="Title the voice agent says" hint="For example: dentist, tax advisor.">
                {(id) => <TextInput id={id} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />}
              </Field>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-2">Services offered</p>
                {lookups.categories.length === 0 ? (
                  <p className="text-sm text-slate-400">No service categories yet. Add them in Organization, under Service categories.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {lookups.categories.map((c) => (
                      <Check
                        key={c.id}
                        label={c.name}
                        checked={categoryIds.includes(c.id)}
                        onChange={(on) => setCategoryIds((list) => (on ? [...new Set([...list, c.id])] : list.filter((x) => x !== c.id)))}
                      />
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Working hours</p>
                <Check
                  label="Follows the business hours"
                  checked={ownHours === null}
                  onChange={(follow) => setOwnHours(follow ? null : (lookups.businessWeek ?? Array.from({ length: 7 }, () => [])).map((r) => r.map((x) => ({ ...x }))))}
                />
                {ownHours !== null && (
                  <>
                    <HoursEditor value={ownHours} onChange={setOwnHours} />
                    <p className="text-xs text-slate-400">A consultant can only be booked when both these hours and the business hours are open.</p>
                  </>
                )}
              </div>
              {employee ? <TimeOffPanel employeeId={employee.id} /> : <p className="text-xs text-slate-400">Save first, then you can add days off.</p>}
            </>
          )}
        </fieldset>
        <Check label="Active" checked={isActive} onChange={setIsActive} />
        <FormActions saving={saving} error={error} onCancel={onCancel} />
      </form>
    </Modal>
  );
};

export const EmployeesTab: React.FC = () => {
  const employees = useAsyncList(api.admin.listEmployees);
  const departments = useAsyncList(api.admin.listDepartments);
  const grades = useAsyncList(api.admin.listGrades);
  const roles = useAsyncList(api.admin.listRoles);
  const categories = useAsyncList(api.admin.listCategories);
  const { businessHours } = useVocabulary();
  const [filter, setFilter] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [editing, setEditing] = useState<EmployeeRow | 'new' | null>(null);

  const loading = employees.loading || departments.loading || grades.loading || roles.loading || categories.loading;
  const error = employees.error || departments.error || grades.error || roles.error || categories.error;
  const reloadAll = async () => {
    await Promise.all([employees.reload(), departments.reload(), grades.reload(), roles.reload(), categories.reload()]);
  };

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return employees.data.filter(
      (e) =>
        matchesStatus(e.isActive, status) &&
        (!departmentFilter || e.department?.id === departmentFilter) &&
        (!q || `${e.code} ${e.fullName} ${e.email ?? ''}`.toLowerCase().includes(q)),
    );
  }, [employees.data, filter, status, departmentFilter]);

  const lookups: Lookups = {
    departments: departments.data.filter((d) => d.isActive),
    grades: grades.data.filter((g) => g.isActive),
    roles: roles.data.filter((r) => r.isActive),
    employees: employees.data,
    categories: categories.data.filter((c) => c.isActive),
    businessWeek: businessHours?.weekly ?? null,
  };

  return (
    <Card>
      <Toolbar
        filter={filter}
        onFilter={setFilter}
        placeholder="Filter employees…"
        status={status}
        onStatus={setStatus}
        addLabel="Add employee"
        onAdd={() => setEditing('new')}
        extra={
          <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} aria-label="Department" className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100">
            <option value="">All departments</option>
            {departments.data.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        }
      />
      <ListState loading={loading} error={error} onRetry={reloadAll} empty={rows.length === 0} emptyText={employees.data.length === 0 ? 'No employees yet. Add the first one.' : 'No employee matches the filter.'}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-800">
              <tr>
                <Th>Code</Th>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Department</Th>
                <Th>Grade</Th>
                <Th>Manager</Th>
                <Th>Consultant</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map((e) => (
                <tr key={e.id}>
                  <Td className="font-mono">{e.code}</Td>
                  <Td>
                    <span className="font-semibold">{e.fullName}</span>
                    {(e.email || e.phone) && <span className="block text-xs text-slate-400">{[e.email, e.phone].filter(Boolean).join(' · ')}</span>}
                  </Td>
                  <Td>{e.role?.name ?? '—'}</Td>
                  <Td>{e.department?.name ?? '—'}</Td>
                  <Td>{e.grade?.code ?? '—'}</Td>
                  <Td>{e.manager?.fullName ?? '—'}</Td>
                  <Td>
                    {e.isBookable ? (
                      <span>
                        {e.title ?? 'Yes'}
                        {e.categories.length > 0 && <span className="block text-xs text-slate-400">{e.categories.map((c) => c.name).join(', ')}</span>}
                      </span>
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td><StatusBadge active={e.isActive} /></Td>
                  <Td><LinkButton onClick={() => setEditing(e)}>Edit</LinkButton></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ListState>
      {editing && (
        <EmployeeForm employee={editing === 'new' ? null : editing} lookups={lookups} onCancel={() => setEditing(null)} onDone={() => { setEditing(null); reloadAll(); }} />
      )}
    </Card>
  );
};
