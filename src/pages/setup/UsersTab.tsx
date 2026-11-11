import React, { useMemo, useState } from 'react';
import { api } from '../../services/api';
import type { EmployeeRow, RoleRow, UserRow } from '../../services/admin-types';
import { useAsyncList, messageOf } from '../../components/setup/useAsyncList';
import { Card, Check, Field, FormModal, LinkButton, ListState, matchesStatus, SelectInput, StatusBadge, Td, TextInput, Th, Toolbar } from '../../components/setup/ui';

export interface UserPreset {
  username: string;
  employeeId: string;
  roleId: string;
}

export const UserForm: React.FC<{
  user: UserRow | null;
  roles: RoleRow[];
  employees: EmployeeRow[];
  /** Starting values for a new login (used by "Create login" on an employee). */
  preset?: UserPreset;
  onDone: () => void;
  onCancel: () => void;
}> = ({ user, roles, employees, preset, onDone, onCancel }) => {
  // A user made before roles were editable has no role id yet; match it by its code.
  const startRole = user ? (user.role.id ?? roles.find((r) => r.code === user.role.code)?.id ?? '') : '';
  const [username, setUsername] = useState(user?.username ?? preset?.username ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [roleId, setRoleId] = useState(startRole || preset?.roleId || '');
  const [employeeId, setEmployeeId] = useState(user?.employee?.id ?? preset?.employeeId ?? '');
  const [isActive, setIsActive] = useState(user?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const usernameProblem = user ? '' : username.trim().length < 3 ? 'The user name needs at least 3 characters.' : /^[A-Za-z0-9._@+-]+$/.test(username.trim()) ? '' : 'Use letters, numbers and . _ @ + - only (no spaces).';
  const passwordProblem = password === '' ? (user ? '' : 'The password is required.') : password.length < 12 ? 'The password needs at least 12 characters.' : '';
  const roleProblem = roleId === '' ? 'Choose a role.' : '';
  const firstProblem = usernameProblem || passwordProblem || roleProblem;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (user) {
        await api.admin.updateUser(user.id, { ...(password ? { password } : {}), name, roleId, employeeId: employeeId || null, isActive });
      } else {
        await api.admin.createUser({ username, password, name, roleId, employeeId: employeeId || null, isActive });
      }
      onDone();
    } catch (err: unknown) {
      setError(messageOf(err, 'Could not save the user.'));
      setSaving(false);
    }
  };

  // Only employees without a login (plus this user's own employee) can be linked.
  const free = employees.filter((e) => e.isActive && (!e.user || e.id === user?.employee?.id));

  return (
    <FormModal title={user ? 'Edit user' : 'Create user'} onClose={onCancel} onSubmit={submit} saving={saving} error={error} size="lg" canSave={!firstProblem} blockedReason={firstProblem}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
        <Field label="User name" hint={user ? 'The user name cannot be changed.' : undefined} error={usernameProblem}>
          {(id) => <TextInput id={id} value={username} onChange={(e) => setUsername(e.target.value)} maxLength={100} readOnly={Boolean(user)} disabled={Boolean(user)} autoComplete="off" aria-invalid={Boolean(usernameProblem)} />}
        </Field>
        <Field label="Password" hint={user ? 'Leave empty to keep it. A new password signs the user out everywhere.' : 'At least 12 characters.'} error={passwordProblem}>
          {(id) => (
            <div className="flex gap-2">
              <TextInput id={id} type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" aria-invalid={Boolean(passwordProblem)} />
              <button type="button" onClick={() => setShowPassword((v) => !v)} aria-pressed={showPassword} className="px-3 rounded-lg bg-slate-800 text-xs text-slate-200 hover:bg-slate-700">
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          )}
        </Field>
        <Field label="Name (optional)">{(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />}</Field>
        <Field label="Role" error={roleProblem}>
          {(id) => (
            <SelectInput id={id} value={roleId} onChange={(e) => setRoleId(e.target.value)} aria-invalid={Boolean(roleProblem)}>
              <option value="" disabled>Select role…</option>
              {roles.filter((r) => r.isActive || r.id === roleId).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </SelectInput>
          )}
        </Field>
        <Field label="Employee (optional)">
          {(id) => (
            <SelectInput id={id} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">— Not linked —</option>
              {free.map((e) => <option key={e.id} value={e.id}>{e.fullName} ({e.code})</option>)}
            </SelectInput>
          )}
        </Field>
        <div className="flex items-end pb-1.5">
          <Check label="Active user" checked={isActive} onChange={setIsActive} />
        </div>
      </div>
    </FormModal>
  );
};

export const UsersTab: React.FC = () => {
  const users = useAsyncList(api.admin.listUsers);
  const roles = useAsyncList(api.admin.listRoles);
  const employees = useAsyncList(api.admin.listEmployees);
  const [filter, setFilter] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active');
  const [roleFilter, setRoleFilter] = useState('');
  const [editing, setEditing] = useState<UserRow | 'new' | null>(null);
  const [toggleError, setToggleError] = useState('');

  const loading = users.loading || roles.loading || employees.loading;
  const error = users.error || roles.error || employees.error;
  const reloadAll = async () => {
    await Promise.all([users.reload(), roles.reload(), employees.reload()]);
  };

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return users.data.filter(
      (u) =>
        matchesStatus(u.isActive, status) &&
        (!roleFilter || u.role.code === roleFilter) &&
        (!q || `${u.username} ${u.name ?? ''} ${u.employee?.fullName ?? ''}`.toLowerCase().includes(q)),
    );
  }, [users.data, filter, status, roleFilter]);

  const setActive = async (u: UserRow, isActive: boolean) => {
    setToggleError('');
    const roleId = u.role.id ?? roles.data.find((r) => r.code === u.role.code)?.id;
    if (!roleId) {
      setToggleError('This user has no role. Open Edit and choose one.');
      return;
    }
    try {
      await api.admin.updateUser(u.id, { name: u.name ?? '', roleId, employeeId: u.employee?.id ?? null, isActive });
      await users.reload();
    } catch (err: unknown) {
      setToggleError(messageOf(err, 'Could not change the user.'));
    }
  };

  return (
    <Card>
      <Toolbar
        filter={filter}
        onFilter={setFilter}
        placeholder="Filter users…"
        status={status}
        onStatus={setStatus}
        addLabel="Add user"
        onAdd={() => setEditing('new')}
        extra={
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Role" className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100">
            <option value="">All roles</option>
            {roles.data.map((r) => <option key={r.id} value={r.code}>{r.name}</option>)}
          </select>
        }
      />
      {toggleError && <p role="alert" className="mx-4 mt-3 text-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{toggleError}</p>}
      <ListState loading={loading} error={error} onRetry={reloadAll} empty={rows.length === 0} emptyText={users.data.length === 0 ? 'No users yet.' : 'No user matches the filter.'}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-800">
              <tr>
                <Th>User name</Th>
                <Th>Role</Th>
                <Th>Employee</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map((u) => (
                <tr key={u.id}>
                  <Td className="font-semibold">
                    {u.username}
                    {u.name && <span className="block text-xs font-normal text-slate-400">{u.name}</span>}
                  </Td>
                  <Td>{u.role.name}</Td>
                  <Td>{u.employee ? `${u.employee.fullName} (${u.employee.code})` : '—'}</Td>
                  <Td><StatusBadge active={u.isActive} /></Td>
                  <Td>
                    <span className="flex gap-4">
                      <LinkButton onClick={() => setEditing(u)}>Edit</LinkButton>
                      {u.isActive ? (
                        <LinkButton danger onClick={() => setActive(u, false)}>Deactivate</LinkButton>
                      ) : (
                        <LinkButton onClick={() => setActive(u, true)}>Activate</LinkButton>
                      )}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ListState>
      {editing && (
        <UserForm user={editing === 'new' ? null : editing} roles={roles.data} employees={employees.data} onCancel={() => setEditing(null)} onDone={() => { setEditing(null); reloadAll(); }} />
      )}
    </Card>
  );
};
