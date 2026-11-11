// Shapes of the setup panel API (`/api/v1/admin/*`). They mirror the backend answers.

/** One opening range, 'HH:MM' to 'HH:MM' (the end may be '24:00'). */
export interface TimeRange { start: string; end: string }
/** Seven lists, Sunday first. A day with no range is closed. */
export type WeeklyHours = TimeRange[][];

export interface Business {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
  /** The time zone and hours that apply now (the saved ones, or the server settings). */
  timeZone: string;
  businessHours: WeeklyHours;
  /** True while nothing has been saved, so the server settings apply. */
  hoursAreDefaults: boolean;
}

export interface Grade {
  id: string;
  code: string;
  name: string | null;
  isActive: boolean;
  employeeCount: number;
}

export interface DepartmentRow {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  contact: string | null;
  email: string | null;
  isActive: boolean;
  employeeCount: number;
  providerCount: number;
}

export interface EmployeeRow {
  id: string;
  code: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  department: { id: string; name: string } | null;
  grade: { id: string; code: string } | null;
  role: { id: string; name: string; code: string } | null;
  manager: { id: string; fullName: string; code: string } | null;
  user: { id: string; email: string } | null;
  /** Consultant: takes appointments. */
  isBookable: boolean;
  title: string | null;
  /** Own weekly hours; null = follows the business hours. */
  workingHours: WeeklyHours | null;
  categories: Array<{ id: string; name: string }>;
}

export interface ServiceCategoryRow {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  consultantCount: number;
}

export interface TimeOffRow {
  id: string;
  startDate: string;
  endDate: string;
  note: string | null;
}

export interface PermissionInfo {
  code: string;
  label: string;
  description: string;
}

export interface RoleRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  permissions: string[];
  isActive: boolean;
  isSystem: boolean;
  userCount: number;
  employeeCount: number;
}

export interface UserRow {
  id: string;
  username: string;
  name: string | null;
  isActive: boolean;
  createdAt: string;
  role: { id: string | null; code: string; name: string };
  employee: { id: string; code: string; fullName: string } | null;
}

export interface BusinessInput {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  latitude: number | null;
  longitude: number | null;
  timeZone: string;
  businessHours: WeeklyHours;
}
export interface GradeInput { code: string; name: string; isActive: boolean }
export interface DepartmentInput { name: string; description: string; location: string; contact: string; email: string; isActive: boolean }
export interface EmployeeInput {
  fullName: string;
  email: string;
  phone: string;
  departmentId: string | null;
  gradeId: string | null;
  roleId: string | null;
  managerId: string | null;
  isActive: boolean;
  isBookable: boolean;
  title: string;
  categoryIds: string[];
  workingHours: WeeklyHours | null;
}
export interface CategoryInput { name: string; description: string; isActive: boolean }
export interface TimeOffInput { startDate: string; endDate: string; note: string }
export interface RoleInput { code: string; name: string; description: string; permissions: string[]; isActive: boolean }
export interface CreateUserInput { username: string; password: string; name: string; roleId: string; employeeId: string | null; isActive: boolean }
export interface UpdateUserInput { password?: string; name: string; roleId: string; employeeId: string | null; isActive: boolean }
