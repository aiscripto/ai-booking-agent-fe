// ── Signed-in session ───────────────────────────────────────────────────────
//
// Holds the short-lived access token and the signed-in user, IN MEMORY ONLY.
//
// Nothing is written to localStorage: a script injected into the page cannot find a token there.
// The long-lived credential is the refresh token, which the server keeps in an httpOnly cookie
// that JavaScript cannot read. After a page reload the memory is empty, and api.ts asks the
// server for a new access token using that cookie (see `restoreSession`).
//
// The tenant is never chosen or sent by the browser: the server reads it from the verified
// token. `user.tenantId` is for display only.
// ────────────────────────────────────────────────────────────────────────────

// Keys used by earlier versions (the fake login and the first real login). Removed so that
// nothing stale stays in the browser.
const LEGACY_KEYS = ['auth_token', 'auth_user', 'tenant_id'];

/** Dispatched on `window` when the session has ended and the user must sign in again. */
export const AUTH_EXPIRED_EVENT = 'auth:expired';

export type UserRole = 'ADMIN' | 'PROVIDER' | 'FRONT_DESK' | 'PATIENT';

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  tenantId: string;
  /** Name of the user's role, for display. */
  roleName: string;
  /** What the user may do. Used only to hide screens; the server checks every request again. */
  permissions: string[];
  /** The employee (consultant) this login is linked to, if any. */
  employeeId: string | null;
}

let accessToken: string | null = null;
let sessionUser: SessionUser | null = null;

function removeLegacyKeys(): void {
  try {
    LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Storage blocked (private window): nothing to remove.
  }
}

/** The current access token, or `null` when there is none in memory. */
export function getToken(): string | null {
  return accessToken;
}

/** The signed-in user, or `null`. */
export function getSessionUser(): SessionUser | null {
  return sessionUser;
}

/** Stores the session returned by login or refresh. */
export function setSession(token: string, user: SessionUser): void {
  accessToken = token;
  sessionUser = user;
  removeLegacyKeys();
}

/** Forgets the session in memory. Called on sign-out and when the server ends the session. */
export function clearSession(): void {
  accessToken = null;
  sessionUser = null;
  removeLegacyKeys();
}

/** True when the signed-in user's role grants the permission. */
export function can(permission: string): boolean {
  return sessionUser?.permissions.includes(permission) ?? false;
}

/** True when the user's role is limited to their own appointments (a consultant login). */
export function isOwnOnly(): boolean {
  return can('appointments.own_only');
}
