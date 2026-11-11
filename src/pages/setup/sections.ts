import { Building2, Landmark, ShieldCheck } from 'lucide-react';
import type React from 'react';

/** The Setup sections that appear under "Setup" in the sidebar. A user sees only the ones their role allows. */
export type SetupSectionId = 'business' | 'organization' | 'users';

export interface SetupSectionInfo {
  id: SetupSectionId;
  /** The sidebar tab id (App.tsx switches on it). */
  tab: string;
  name: string;
  permission: string;
  icon: React.ElementType;
}

export const SETUP_SECTIONS: SetupSectionInfo[] = [
  { id: 'business', tab: 'setup-business', name: 'Business', permission: 'settings.business', icon: Building2 },
  { id: 'organization', tab: 'setup-organization', name: 'Organization', permission: 'organization.manage', icon: Landmark },
  { id: 'users', tab: 'setup-users', name: 'User Management', permission: 'users.manage', icon: ShieldCheck },
];

export const isSetupTab = (tab: string): boolean => tab.startsWith('setup-');
