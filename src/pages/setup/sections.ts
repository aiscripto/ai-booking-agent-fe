import { Building2, Landmark, ShieldCheck } from 'lucide-react';
import type React from 'react';

/** The Setup sections that appear under "Setup" in the sidebar. A user sees only the ones their role allows. */
export type SetupSectionId = 'business' | 'organization' | 'users';

export interface SetupSectionInfo {
  id: SetupSectionId;
  /** The sidebar tab id (App.tsx switches on it). */
  tab: string;
  name: string;
  /** The section is shown when the user has ANY of these. */
  permissions: string[];
  icon: React.ElementType;
}

export const SETUP_SECTIONS: SetupSectionInfo[] = [
  { id: 'business', tab: 'setup-business', name: 'Business', permissions: ['settings.business'], icon: Building2 },
  { id: 'organization', tab: 'setup-organization', name: 'Organization', permissions: ['organization.manage'], icon: Landmark },
  { id: 'users', tab: 'setup-users', name: 'User Management', permissions: ['users.manage', 'audit.view'], icon: ShieldCheck },
];

export const isSetupTab = (tab: string): boolean => tab.startsWith('setup-');
