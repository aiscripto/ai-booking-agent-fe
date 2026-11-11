import React, { useState } from 'react';
import { Award, Building2, Clock, History, Landmark, ShieldCheck, Tags, User, Users } from 'lucide-react';
import type { SetupSectionId } from './sections';
import { can } from '../../services/session';
import { BusinessSection } from './BusinessSection';
import { GradesTab } from './GradesTab';
import { DepartmentsTab } from './DepartmentsTab';
import { EmployeesTab } from './EmployeesTab';
import { CategoriesTab } from './CategoriesTab';
import { RolesTab } from './RolesTab';
import { UsersTab } from './UsersTab';
import { AuditTab } from './AuditTab';

type SectionId = SetupSectionId;

interface Tab {
  id: string;
  label: string;
  icon: React.ElementType;
  /** The user needs this permission to see the tab. */
  permission: string;
  /** One sentence shown at the right of the tab bar while this tab is open. */
  description: string;
  view: React.ReactNode;
}

const SECTIONS: Array<{
  id: SectionId;
  name: string;
  description: string;
  icon: React.ElementType;
  tabs: Tab[];
}> = [
  {
    id: 'business',
    name: 'Business',
    description: 'Contact details, location, time zone and opening hours of the business.',
    icon: Building2,
    tabs: [
      { id: 'details', permission: 'settings.business', label: 'Details', icon: Building2, description: 'Name, contact details, address and location on the map.', view: <BusinessSection part="details" /> },
      { id: 'hours', permission: 'settings.business', label: 'Opening hours', icon: Clock, description: 'Time zone and the hours when appointments can be booked.', view: <BusinessSection part="hours" /> },
    ],
  },
  {
    id: 'organization',
    name: 'Organization',
    description: 'Grades, departments, service categories and employees (including consultants).',
    icon: Landmark,
    tabs: [
      { id: 'grades', permission: 'organization.manage', label: 'Grades', icon: Award, description: 'Career grades. You choose the code; the system keeps the id.', view: <GradesTab /> },
      { id: 'departments', permission: 'organization.manage', label: 'Departments', icon: Building2, description: 'How the business is organized, with location and contact.', view: <DepartmentsTab /> },
      { id: 'categories', permission: 'organization.manage', label: 'Service categories', icon: Tags, description: 'What callers can book, for example Dentist. Chosen on each consultant.', view: <CategoriesTab /> },
      { id: 'employees', permission: 'organization.manage', label: 'Employees', icon: Users, description: 'The people of the business. A consultant is an employee who takes appointments.', view: <EmployeesTab /> },
    ],
  },
  {
    id: 'users',
    name: 'User Management',
    description: 'Roles, what each role may do, and user accounts.',
    icon: ShieldCheck,
    tabs: [
      { id: 'roles', permission: 'users.manage', label: 'Roles', icon: ShieldCheck, description: 'The roles a user can hold, and what each role may do.', view: <RolesTab /> },
      { id: 'accounts', permission: 'users.manage', label: 'User Accounts', icon: User, description: 'Application logins. An account can be linked to an employee.', view: <UsersTab /> },
      { id: 'audit', permission: 'audit.view', label: 'Audit log', icon: History, description: 'Who did what and when. Read only.', view: <AuditTab /> },
    ],
  },
];

/** One Setup section, chosen in the sidebar. The server checks the user's permission again on every call. */
export const SetupView: React.FC<{ section: SectionId }> = ({ section: sectionId }) => {
  const [tabId, setTabId] = useState<Record<string, string>>({});
  const section = SECTIONS.find((s) => s.id === sectionId);

  const visibleTabs = section ? section.tabs.filter((t) => can(t.permission)) : [];
  if (!section || visibleTabs.length === 0) {
    return (
      <div role="alert" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-sm text-slate-300">
        Your role does not allow this setup screen.
      </div>
    );
  }

  const tab = visibleTabs.find((t) => t.id === tabId[section.id]) ?? visibleTabs[0];
  const Icon = section.icon;

  return (
    <section className="space-y-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <Icon className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-lg font-bold text-slate-100">{section.name}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/10 text-sky-300 border border-sky-500/30">Setup</span>
              </div>
              <p className="text-sm text-slate-300">{section.description}</p>
            </div>
          </div>
        </div>

        {visibleTabs.length > 1 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl px-3 py-2.5 flex flex-wrap items-center gap-x-2 gap-y-2">
            <div role="tablist" aria-label={`${section.name} sections`} className="flex flex-wrap items-center gap-1.5">
              {visibleTabs.map((t, n) => {
                const active = t.id === tab.id;
                const TabIcon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTabId({ ...tabId, [section.id]: t.id })}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors ${active ? 'bg-sky-600 text-white' : 'text-slate-200 hover:bg-slate-800'}`}
                  >
                    <span className={`min-w-5 h-5 px-1 inline-flex items-center justify-center rounded text-[11px] font-bold ${active ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'}`}>{n + 1}</span>
                    <TabIcon className="w-4 h-4" aria-hidden="true" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="ml-auto text-xs text-slate-300 max-w-md text-right">{tab.description}</p>
          </div>
        )}

        <div role="tabpanel" key={`${section.id}-${tab.id}`}>
          {tab.view}
        </div>
    </section>
  );
};
