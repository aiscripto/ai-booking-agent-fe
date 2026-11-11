import React, { useState } from 'react';
import { Building2, Landmark, ShieldCheck } from 'lucide-react';
import { can } from '../../services/session';
import { BusinessSection } from './BusinessSection';
import { GradesTab } from './GradesTab';
import { DepartmentsTab } from './DepartmentsTab';
import { EmployeesTab } from './EmployeesTab';
import { RolesTab } from './RolesTab';
import { UsersTab } from './UsersTab';

type SectionId = 'business' | 'organization' | 'users';

interface Tab {
  id: string;
  label: string;
  view: React.ReactNode;
}

const SECTIONS: Array<{
  id: SectionId;
  number: number;
  name: string;
  description: string;
  permission: string;
  icon: React.ElementType;
  tabs: Tab[];
}> = [
  {
    id: 'business',
    number: 0,
    name: 'Business',
    description: 'Name, contact details, address and location of the business.',
    permission: 'settings.business',
    icon: Building2,
    tabs: [{ id: 'details', label: 'Details', view: <BusinessSection /> }],
  },
  {
    id: 'organization',
    number: 1,
    name: 'Organization',
    description: 'Grades, departments and employees.',
    permission: 'organization.manage',
    icon: Landmark,
    tabs: [
      { id: 'grades', label: 'Grades', view: <GradesTab /> },
      { id: 'departments', label: 'Departments', view: <DepartmentsTab /> },
      { id: 'employees', label: 'Employees', view: <EmployeesTab /> },
    ],
  },
  {
    id: 'users',
    number: 2,
    name: 'User Management',
    description: 'Roles, what each role may do, and user accounts.',
    permission: 'users.manage',
    icon: ShieldCheck,
    tabs: [
      { id: 'roles', label: 'Roles', view: <RolesTab /> },
      { id: 'accounts', label: 'User Accounts', view: <UsersTab /> },
    ],
  },
];

/** The Setup page: the sections the signed-in user is allowed to use. The server checks again on every call. */
export const SetupView: React.FC = () => {
  const allowed = SECTIONS.filter((s) => can(s.permission));
  const [sectionId, setSectionId] = useState<SectionId>(allowed[0]?.id ?? 'business');
  const [tabId, setTabId] = useState<Record<string, string>>({});

  if (allowed.length === 0) {
    return (
      <div role="alert" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-sm text-slate-300">
        Your role does not allow any setup screen.
      </div>
    );
  }

  const section = allowed.find((s) => s.id === sectionId) ?? allowed[0];
  const tab = section.tabs.find((t) => t.id === tabId[section.id]) ?? section.tabs[0];
  const Icon = section.icon;

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <nav aria-label="Setup sections" className="lg:w-56 shrink-0 space-y-1">
        {allowed.map((s) => {
          const active = s.id === section.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSectionId(s.id)}
              aria-current={active ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left ${active ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30' : 'text-slate-300 hover:bg-slate-800/60'}`}
            >
              <span className="w-5 text-center text-xs text-slate-400">{s.number}</span>
              <span>{s.name}</span>
            </button>
          );
        })}
      </nav>

      <section className="flex-1 min-w-0 space-y-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <Icon className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-100">{section.name}</h1>
              <p className="text-sm text-slate-400">{section.description}</p>
            </div>
          </div>
          {section.tabs.length > 1 && (
            <div role="tablist" aria-label={`${section.name} sections`} className="flex flex-wrap gap-2">
              {section.tabs.map((t) => {
                const active = t.id === tab.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTabId({ ...tabId, [section.id]: t.id })}
                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${active ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div role="tabpanel" key={`${section.id}-${tab.id}`}>
          {tab.view}
        </div>
      </section>
    </div>
  );
};
