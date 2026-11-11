// ── Network boundary ────────────────────────────────────────────────────────
//
// R5: every HTTP call in this app goes through this module. No component or
// page may call `fetch` directly.
// ────────────────────────────────────────────────────────────────────────────

import { API_BASE_URL } from '../config/env';
import { AUTH_EXPIRED_EVENT, clearSession, getSessionUser, getToken, setSession } from './session';
import type { SessionUser } from './session';
import type * as A from './admin-types';

const CSRF_HEADER = { 'X-Requested-With': 'fetch' };

// Several requests can find the token expired at once; they share one refresh.
let refreshing: Promise<boolean> | null = null;

/**
 * Asks the server for a new access token using the refresh cookie (the browser sends it by
 * itself; this code never sees it). Returns false when the server says the session is over.
 *
 * @throws {Error} when the server cannot be reached (the session is kept, so the user can retry).
 */
function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...CSRF_HEADER },
      });
    } catch {
      throw new Error('Could not reach the server. Please check your connection.');
    }

    if (res.status === 401 || res.status === 400) {
      clearSession();
      return false;
    }
    if (!res.ok) {
      throw new Error('Could not renew your session. Please try again.');
    }

    const result = await readJson(res);
    if (result.status !== 'success') {
      clearSession();
      return false;
    }
    setSession(result.data.token, result.data.user);
    return true;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/** Ends the session in the app and tells the screens to show the login page. */
function endSession(): void {
  clearSession();
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
}

function send(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
      Authorization: `Bearer ${getToken()}`,
    },
  });
}

/**
 * Sends a request with the access token.
 *
 * The tenant is never sent: the server reads it from the verified token. If there is no token
 * in memory (after a page reload) or the server answers 401 (the 15-minute token ran out), the
 * token is renewed once from the refresh cookie and the request is repeated. If that fails the
 * session is over and the app returns to the login screen.
 *
 * @throws {Error} when not signed in or the session has ended.
 */
async function request(url: string, init: RequestInit = {}): Promise<Response> {
  if (!getToken() && !(await refreshSession())) {
    endSession();
    throw new Error('Please sign in.');
  }

  let res = await send(url, init);
  if (res.status === 401) {
    if (await refreshSession()) {
      res = await send(url, init);
    }
    if (res.status === 401) {
      endSession();
      throw new Error('Your session has expired. Please sign in again.');
    }
  }
  return res;
}

/**
 * Reads the server's answer as JSON. If the answer is not JSON (for example a web page from the wrong
 * server, or an error page from a proxy), say so in plain words instead of showing a parser error.
 */
async function readJson(res: Response): Promise<any> {
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) {
    throw new Error(
      `The server did not answer as expected (HTTP ${res.status}). Check that the website is connected to the right server.`
    );
  }
  return res.json();
}

/**
 * Unwraps the canonical API envelope: `{ status, data }` on success,
 * `{ status: 'error', message }` on failure.
 *
 * @throws {Error} carrying the server's message when `status` is `'error'`.
 */
async function unwrap<T>(res: Response): Promise<T> {
  const result = await readJson(res);
  if (result.status === 'error') {
    throw new Error(result.message || `Request failed with status ${res.status}`);
  }
  return result.data as T;
}

/** A bookable provider. Never call this a "Doctor" in UI copy — see vocabulary.ts. */
export interface Resource {
  id: string;
  name: string;
  email: string;
  title?: string | null;
  departmentId?: string | null;
}

/** An organisational grouping of resources. */
export interface Department {
  id: string;
  name: string;
  code?: string;
  description?: string;
  buildingLocation?: string;
  isHipaaRestricted?: boolean;
  maxDailyBookings?: number;
}

/** A bookable service offered by the tenant. */
export interface ServiceType {
  id: string;
  name: string;
  durationMinutes?: number;
}

/**
 * Tenant identity, white-label branding and bookable inventory.
 * Shape mirrors `GET /api/v1/tenant/branding`.
 */
export interface TenantBranding {
  tenantId: string;
  name: string;
  industry: string;
  /** The zone to show times in (times are stored in UTC). */
  timeZone: string;
  businessHours: BusinessHours;
  branding: Record<string, unknown> | null;
  resources: Resource[];
  serviceTypes: ServiceType[];
  departments: Department[];
}

/** Industry-specific label set. Shape mirrors `GET /api/v1/tenant/vocabulary`. */
export interface TenantVocabularyResponse {
  tenantId: string;
  tenantName: string | null;
  industry: string | null;
  /** The zone to show times in (times are stored in UTC). */
  timeZone: string;
  businessHours: BusinessHours;
  vocabulary: {
    resourceLabel: string;
    customerLabel: string;
    serviceLabel: string;
    statusInProgress: string;
  };
}

/** Video consultation providers the backend can provision a room with. */
export type TelehealthProvider = 'DAILY' | 'ZOOM' | 'GOOGLE_MEET';

/** A provisioned video consultation room. */
export interface TelehealthRoom {
  roomUrl: string;
  provider?: TelehealthProvider;
  expiresAt?: string | null;
}

export interface Appointment {
  id: string;
  tenantId: string;
  calendarId: string;
  /** Who the appointment is with (consultant mode). Empty for older bookings. */
  employeeId?: string | null;
  employee?: { id: string; fullName: string } | null;
  category?: { id: string; name: string } | null;
  /** Only in the answer to a new booking. */
  consultant?: { id: string; fullName: string; title: string | null } | null;
  appointmentDateTime: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  status: string;
  googleEventId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CallLog {
  id: string;
  tenantId: string;
  voiceAgentId: string | null;
  callSid: string | null;
  duration: number | null;
  status: string;
  /** Only present when a single log is fetched with getCallLog. */
  transcript?: string | null;
  /** Only present when a single log is fetched with getCallLog. */
  payload?: any;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  purpose: string | null;
  createdAt: string;
  updatedAt: string;
}

/** When appointments can be offered. Days: 0 = Sunday ... 6 = Saturday. Times are 24-hour HH:MM. */
export interface BusinessHours {
  /** Earliest opening of the week (short form, for the day grid). */
  start: string;
  /** Latest closing of the week (never 24:00). */
  end: string;
  /** Weekdays with any opening hours. */
  days: number[];
  /** The full answer: seven lists (Sunday first) of {start, end} ranges. */
  weekly: Array<Array<{ start: string; end: string }>>;
}

/** Free times for one date, as the server works them out (appointments plus Google Calendar). */
export interface AvailableSlots {
  /** The business is closed that day. */
  closed: boolean;
  /** The calendar could not be read, so no times could be worked out. */
  unavailable: boolean;
  /** The server's own sentence about the day. */
  message: string;
  /** Each free time: the UTC instant to book and the label to show (in the business's time zone). */
  slots: Array<{ iso: string; label: string; /** Consultants free at that time (empty without consultants). */ consultants: string[]; /** The same consultants as ids. */ consultantIds: string[] }>;
}

/** Who can be booked and for what. Empty lists mean the business books one calendar. */
export interface ConsultantsInfo {
  categories: Array<{ id: string; name: string; description: string | null }>;
  consultants: Array<{ id: string; fullName: string; title: string | null; categoryIds: string[] }>;
}

/** tenant = its own Google account, shared = the server's shared account, none = no Google account. */
export type GoogleSource = 'tenant' | 'shared' | 'none';

export const api = {
  // ── Sign-in ───────────────────────────────────────────────────────────────

  /**
   * Signs in with email and password. Uses plain `fetch` because there is no token yet.
   * The server also sets the refresh cookie on this response; the app never handles it.
   *
   * @throws {Error} with the server's message (wrong credentials, too many attempts).
   */
  async login(email: string, password: string): Promise<{ token: string; user: SessionUser }> {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return unwrap<{ token: string; user: SessionUser }>(res);
  },

  /**
   * The signed-in user. Used at start-up to check that a stored token still works.
   *
   * @throws {Error} when the token is missing, expired or the user is disabled.
   */
  async getMe(): Promise<SessionUser> {
    const res = await request(`${API_BASE_URL}/auth/me`);
    return unwrap<SessionUser>(res);
  },

  /**
   * Called when the app starts. After a page reload there is no token in memory, so this asks the
   * server for one using the refresh cookie. Returns the signed-in user, or `null` when the
   * cookie is missing or no longer valid (show the login page).
   *
   * @throws {Error} when the server cannot be reached.
   */
  async restoreSession(): Promise<SessionUser | null> {
    return (await refreshSession()) ? getSessionUser() : null;
  },

  /**
   * Signs out: the server clears the cookie and ends the user's sessions on every device.
   * The local session is cleared even if the server cannot be reached.
   */
  async logout(): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...CSRF_HEADER },
      });
    } catch {
      // Offline: the cookie will expire by itself. Still sign out here.
    } finally {
      clearSession();
    }
  },

  /**
   * Fetches appointments, optionally filtered by a specific date (YYYY-MM-DD).
   */
  async getAppointments(date?: string): Promise<Appointment[]> {
    const url = date ? `${API_BASE_URL}/appointments?date=${date}` : `${API_BASE_URL}/appointments`;
    const res = await request(url, {
      method: 'GET'
    });
    const result = await readJson(res);
    if (result.status === 'error') {
      throw new Error(result.message);
    }
    return result.data || [];
  },

  /**
   * Creates a new appointment.
   */
  async createAppointment(data: {
    dateTime: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string | null;
    /** Consultant mode: a consultant and/or a service (ids). Leave out for "anyone". */
    employeeId?: string;
    categoryId?: string;
  }): Promise<Appointment> {
    const res = await request(`${API_BASE_URL}/appointments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const result = await readJson(res);
    if (result.status === 'error') {
      throw new Error(result.message);
    }
    return result.data;
  },

  /**
   * Cancels an appointment.
   */
  async cancelAppointment(id: string): Promise<void> {
    const res = await request(`${API_BASE_URL}/appointments/${id}`, {
      method: 'DELETE'
    });
    const result = await readJson(res);
    if (result.status === 'error') {
      throw new Error(result.message);
    }
  },

  /**
   * Fetches the call logs for the tenant.
   */
  async getCallLogs(): Promise<CallLog[]> {
    const res = await request(`${API_BASE_URL}/appointments/logs`, {
      method: 'GET'
    });
    const result = await readJson(res);
    if (result.status === 'error') {
      throw new Error(result.message);
    }
    return result.data || [];
  },

  /**
   * Fetches one call log including transcript and payload.
   */
  async getCallLog(id: string): Promise<CallLog> {
    const res = await request(`${API_BASE_URL}/appointments/logs/${encodeURIComponent(id)}`, {
      method: 'GET'
    });
    const result = await readJson(res);
    if (result.status === 'error') {
      throw new Error(result.message);
    }
    return result.data;
  },

  /**
   * Gets the Google OAuth consent redirect URL for the signed-in admin's own tenant.
   */
  async getGoogleAuthUrl(): Promise<string> {
    const res = await request(`${API_BASE_URL}/auth/google`, {
      method: 'GET',
    });
    const result = await readJson(res);
    if (result.status === 'error') {
      throw new Error(result.message);
    }
    return result.authUrl;
  },

  /**
   * The free times for one date (YYYY-MM-DD) for the signed-in user's own business.
   *
   * @throws {Error} when not signed in or the server returns an error.
   */
  async getAvailableSlots(date: string, filter: { categoryId?: string; employeeId?: string } = {}): Promise<AvailableSlots> {
    const user = getSessionUser();
    if (!user) throw new Error('Please sign in.');
    const query = `tenant_id=${encodeURIComponent(user.tenantId)}&date=${encodeURIComponent(date)}&limit=50${filter.categoryId ? `&category=${encodeURIComponent(filter.categoryId)}` : ''}${filter.employeeId ? `&consultant=${encodeURIComponent(filter.employeeId)}` : ''}`;
    const res = await request(`${API_BASE_URL}/voice/check-availability?${query}`);
    const data = await unwrap<{
      responseText: string;
      closed: boolean;
      unavailable: boolean;
      availableSlots: string[];
      availableSlotsIso: string[];
      slotConsultants?: string[][];
      slotConsultantIds?: string[][];
    }>(res);
    return {
      closed: data.closed,
      unavailable: data.unavailable,
      message: data.responseText,
      slots: data.availableSlotsIso.map((iso, i) => ({ iso, label: data.availableSlots[i], consultants: data.slotConsultants?.[i] ?? [], consultantIds: data.slotConsultantIds?.[i] ?? [] })),
    };
  },

  /**
   * Which Google account the tenant's calendar uses: its own, the shared one from the server
   * settings, or none. Read only.
   */
  async getGoogleStatus(): Promise<GoogleSource> {
    const res = await request(`${API_BASE_URL}/auth/google/status`);
    const data = await unwrap<{ source: GoogleSource }>(res);
    return data.source;
  },

  // ── Tenant ────────────────────────────────────────────────────────────────

  /**
   * Tenant branding, resources (providers) and departments.
   *
   * For the signed-in user's own tenant (the server reads it from the token).
   *
   * @throws {Error} when not signed in or the API returns an error.
   */
  async getBranding(): Promise<TenantBranding> {
    const res = await request(`${API_BASE_URL}/tenant/branding`);
    return unwrap<TenantBranding>(res);
  },

  /**
   * Industry-specific label set for the tenant.
   *
   * @see src/services/vocabulary.ts — never hardcode a domain noun in the UI.
   * @throws {Error} when not signed in or the API returns an error.
   */
  async getVocabulary(): Promise<TenantVocabularyResponse> {
    const res = await request(`${API_BASE_URL}/tenant/vocabulary`);
    return unwrap<TenantVocabularyResponse>(res);
  },

  /** Consultants and service categories (active only), for the booking screens. */
  async getConsultants(): Promise<ConsultantsInfo> {
    return unwrap<ConsultantsInfo>(await request(`${API_BASE_URL}/tenant/consultants`));
  },

  // ── Resources (providers) ─────────────────────────────────────────────────

  /**
   * Onboards a new bookable resource for the tenant.
   *
   * @security Tenant-scoped: the server derives ownership from the login token. Admins only.
   * @throws {Error} when not signed in or the API returns an error.
   */
  async createResource(input: {
    name: string;
    email: string;
    title?: string;
    departmentId?: string;
  }): Promise<Resource> {
    const res = await request(`${API_BASE_URL}/tenant/resources`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return unwrap<Resource>(res);
  },

  /**
   * Offboards a resource, removing it from active booking availability.
   *
   * @security Tenant-scoped: the server derives ownership from the login token. Admins only.
   * @throws {Error} when not signed in or the API returns an error.
   */
  async deleteResource(resourceId: string): Promise<void> {
    const res = await request(
      `${API_BASE_URL}/tenant/resources/${encodeURIComponent(resourceId)}`,
      { method: 'DELETE' }
    );
    await unwrap<unknown>(res);
  },

  // ── Telehealth ────────────────────────────────────────────────────────────

  /**
   * Creates a video consultation room for an appointment and returns its URL.
   *
   * @security Tenant-scoped via the login token. This endpoint does
   *   NOT take an API key — the webhook key belongs to the voice provider and
   *   must never be shipped in a browser bundle.
   * @throws {Error} when not signed in or the API returns an error.
   */
  async createTelehealthRoom(
    appointmentId: string,
    provider: TelehealthProvider = 'DAILY'
  ): Promise<TelehealthRoom> {
    const res = await request(
      `${API_BASE_URL}/appointments/${encodeURIComponent(appointmentId)}/telehealth`,
      { method: 'POST', body: JSON.stringify({ provider }) }
    );
    return unwrap<TelehealthRoom>(res);
  },

  // ── Setup panel (admin) ───────────────────────────────────────────────────
  // Every call is for the signed-in user's own business; the server reads the tenant from the
  // token and checks the user's permission again.

  admin: {
    async getBusiness(): Promise<A.Business> {
      return unwrap<A.Business>(await request(`${API_BASE_URL}/admin/business`));
    },
    async saveBusiness(input: A.BusinessInput): Promise<A.Business> {
      return unwrap<A.Business>(await request(`${API_BASE_URL}/admin/business`, { method: 'PUT', body: JSON.stringify(input) }));
    },

    async listGrades(): Promise<A.Grade[]> {
      return unwrap<A.Grade[]>(await request(`${API_BASE_URL}/admin/grades`));
    },
    async createGrade(input: A.GradeInput): Promise<A.Grade> {
      return unwrap<A.Grade>(await request(`${API_BASE_URL}/admin/grades`, { method: 'POST', body: JSON.stringify(input) }));
    },
    async updateGrade(id: string, input: A.GradeInput): Promise<A.Grade> {
      return unwrap<A.Grade>(await request(`${API_BASE_URL}/admin/grades/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) }));
    },
    async deleteGrade(id: string): Promise<void> {
      await unwrap<unknown>(await request(`${API_BASE_URL}/admin/grades/${encodeURIComponent(id)}`, { method: 'DELETE' }));
    },

    async listDepartments(): Promise<A.DepartmentRow[]> {
      return unwrap<A.DepartmentRow[]>(await request(`${API_BASE_URL}/admin/departments`));
    },
    async createDepartment(input: A.DepartmentInput): Promise<A.DepartmentRow> {
      return unwrap<A.DepartmentRow>(await request(`${API_BASE_URL}/admin/departments`, { method: 'POST', body: JSON.stringify(input) }));
    },
    async updateDepartment(id: string, input: A.DepartmentInput): Promise<A.DepartmentRow> {
      return unwrap<A.DepartmentRow>(await request(`${API_BASE_URL}/admin/departments/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) }));
    },
    async deleteDepartment(id: string): Promise<void> {
      await unwrap<unknown>(await request(`${API_BASE_URL}/admin/departments/${encodeURIComponent(id)}`, { method: 'DELETE' }));
    },

    async listEmployees(): Promise<A.EmployeeRow[]> {
      return unwrap<A.EmployeeRow[]>(await request(`${API_BASE_URL}/admin/employees`));
    },
    async createEmployee(input: A.EmployeeInput): Promise<A.EmployeeRow> {
      return unwrap<A.EmployeeRow>(await request(`${API_BASE_URL}/admin/employees`, { method: 'POST', body: JSON.stringify(input) }));
    },
    async updateEmployee(id: string, input: A.EmployeeInput): Promise<A.EmployeeRow> {
      return unwrap<A.EmployeeRow>(await request(`${API_BASE_URL}/admin/employees/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) }));
    },

    async listCategories(): Promise<A.ServiceCategoryRow[]> {
      return unwrap<A.ServiceCategoryRow[]>(await request(`${API_BASE_URL}/admin/categories`));
    },
    async createCategory(input: A.CategoryInput): Promise<A.ServiceCategoryRow> {
      return unwrap<A.ServiceCategoryRow>(await request(`${API_BASE_URL}/admin/categories`, { method: 'POST', body: JSON.stringify(input) }));
    },
    async updateCategory(id: string, input: A.CategoryInput): Promise<A.ServiceCategoryRow> {
      return unwrap<A.ServiceCategoryRow>(await request(`${API_BASE_URL}/admin/categories/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) }));
    },
    async deleteCategory(id: string): Promise<void> {
      await unwrap<unknown>(await request(`${API_BASE_URL}/admin/categories/${encodeURIComponent(id)}`, { method: 'DELETE' }));
    },

    async listTimeOff(employeeId: string): Promise<A.TimeOffRow[]> {
      return unwrap<A.TimeOffRow[]>(await request(`${API_BASE_URL}/admin/employees/${encodeURIComponent(employeeId)}/time-off`));
    },
    async addTimeOff(employeeId: string, input: A.TimeOffInput): Promise<A.TimeOffRow> {
      return unwrap<A.TimeOffRow>(await request(`${API_BASE_URL}/admin/employees/${encodeURIComponent(employeeId)}/time-off`, { method: 'POST', body: JSON.stringify(input) }));
    },
    async deleteTimeOff(id: string): Promise<void> {
      await unwrap<unknown>(await request(`${API_BASE_URL}/admin/time-off/${encodeURIComponent(id)}`, { method: 'DELETE' }));
    },

    async listPermissions(): Promise<A.PermissionInfo[]> {
      return unwrap<A.PermissionInfo[]>(await request(`${API_BASE_URL}/admin/permissions`));
    },
    async listRoles(): Promise<A.RoleRow[]> {
      return unwrap<A.RoleRow[]>(await request(`${API_BASE_URL}/admin/roles`));
    },
    async createRole(input: A.RoleInput): Promise<A.RoleRow> {
      return unwrap<A.RoleRow>(await request(`${API_BASE_URL}/admin/roles`, { method: 'POST', body: JSON.stringify(input) }));
    },
    async updateRole(id: string, input: A.RoleInput): Promise<A.RoleRow> {
      return unwrap<A.RoleRow>(await request(`${API_BASE_URL}/admin/roles/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) }));
    },
    async deleteRole(id: string): Promise<void> {
      await unwrap<unknown>(await request(`${API_BASE_URL}/admin/roles/${encodeURIComponent(id)}`, { method: 'DELETE' }));
    },

    async listUsers(): Promise<A.UserRow[]> {
      return unwrap<A.UserRow[]>(await request(`${API_BASE_URL}/admin/users`));
    },
    async createUser(input: A.CreateUserInput): Promise<A.UserRow> {
      return unwrap<A.UserRow>(await request(`${API_BASE_URL}/admin/users`, { method: 'POST', body: JSON.stringify(input) }));
    },
    async updateUser(id: string, input: A.UpdateUserInput): Promise<A.UserRow> {
      return unwrap<A.UserRow>(await request(`${API_BASE_URL}/admin/users/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) }));
    },
  },
};
