import React, { useMemo, useState } from 'react';
import { api } from '../../services/api';
import type { EmployeeRow } from '../../services/admin-types';
import { useAsyncList, messageOf } from '../../components/setup/useAsyncList';
import { Card, Check, Field, FormActions, LinkButton, ListState, matchesStatus, Modal, SelectInput, StatusBadge, Td, TextInput, Th, Toolbar } from '../../components/setup/ui';

interface Lookups {
  departments: Array<{ id: string; name: string }>;
  grades: Array<{ id: string; code: string }>;
  roles: Array<{ id: string; name: string }>;
  employees: EmployeeRow[];
}

const EmployeeForm: React.FC<{ employee: EmployeeRow | null; lookups: Lookups; onDone: () => void; onCancel: () => void }> = ({ employee, lookups, onDone, onCancel }) => {
  const [fullName, setFullName] = useState(employee?.fullName ?? '');
  const [roleId, setRoleId] = useState(employee?.role?.id ?? '');
  const [departmentId, setDepartmentId] = useState(employee?.department?.id ?? '');
  const [email, setEmail] = useState(employee?.email ?? '');
  const [phone, setPhone] = useState(employee?.phone ?? '');
  const [gradeId, setGradeId] = useState(employee?.grade?.id ?? '');
  const [managerId, setManagerId] = useState(employee?.manager?.id ?? '');
  const [isActive, setIsActive] = useState(employee?.isActive ?? true);
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
  const [filter, setFilter] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [editing, setEditing] = useState<EmployeeRow | 'new' | null>(null);

  const loading = employees.loading || departments.loading || grades.loading || roles.loading;
  const error = employees.error || departments.error || grades.error || roles.error;
  const reloadAll = async () => {
    await Promise.all([employees.reload(), departments.reload(), grades.reload(), roles.reload()]);
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
