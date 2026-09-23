// Dashboard sign-in.
//
// Accounts are the Frappe ones: the password is checked by the server against
// the `User` table, and the signed-in profile (name, email, photo, roles) is
// read back from the database. Nothing about an account is hardcoded here any
// more, and a successful sign-in is recorded server-side on `User.last_login`.
//
// This is still not the security boundary — the Frappe API token in `.env` is
// what actually authorises the data the dashboard reads. What the login does
// give you is a real account per person instead of one shared secret baked
// into the bundle.

import {
  fetchUserRoles,
  findFrappeUser,
  frappeLogin,
  frappeLogout,
  InvalidCredentialsError,
} from "../api/authApi";
import { FrappeError, frappeFileUrl } from "../api/frappeClient";
import { sha256Hex } from "./sha256";

/** The signed-in person, as the UI needs them. */
export interface AuthUser {
  /** Frappe `User.name` — the user id, normally an email address. */
  id: string;
  fullName: string;
  email: string;
  /** Absolute URL of the profile photo, or `null`. */
  imageUrl: string | null;
  roles: string[];
  /** Which credential store accepted them. */
  source: "frappe" | "local";
  /** ISO timestamp of the sign-in. */
  signedInAt: string;
}

export type SignInResult = { ok: true; user: AuthUser } | { ok: false; message: string };

const SESSION_KEY = "ats-app-session";

// ─────────────────────────────────────────────────────────────────────────────
// Offline fallback account
// ─────────────────────────────────────────────────────────────────────────────
// Kept so the dashboard is still reachable when Frappe is down or unreachable —
// losing the backend should not also lock out the screen that explains the
// backend is down. It is tried only after the server has refused to answer at
// all, never to override a Frappe rejection, and it grants no extra access:
// every page behind it still needs the API token to load anything.
//
// Set VITE_ALLOW_LOCAL_LOGIN=false in `.env` to remove it entirely.
const LOCAL_USERNAME = "ADMINISTRATOR";
const LOCAL_PASSWORD_SHA256 = "8f570d3f3c8a951cfe70fbe1e8f5d4ff6e50bcca232d4d912d0f2eedee82e067";
const LOCAL_LOGIN_ENABLED = import.meta.env.VITE_ALLOW_LOCAL_LOGIN !== "false";

async function verifyLocal(username: string, password: string): Promise<boolean> {
  if (!LOCAL_LOGIN_ENABLED) return false;
  const nameOk = username.trim().toUpperCase() === LOCAL_USERNAME;
  // `crypto.subtle` is undefined on a plain-HTTP LAN origin, so this hashes in
  // plain JS there rather than throwing (see `sha256.ts`).
  const hash = await sha256Hex(password);
  return nameOk && hash === LOCAL_PASSWORD_SHA256;
}

/**
 * Signs in against Frappe, falling back to the offline account only when the
 * server could not be reached at all.
 *
 * Never throws: every failure comes back as `{ ok: false, message }` so the
 * login button can always return to an idle state.
 */
export async function signInUser(username: string, password: string): Promise<SignInResult> {
  const usr = username.trim();
  if (!usr || !password) return { ok: false, message: "Enter a username and password." };

  try {
    const fullName = await frappeLogin(usr, password);
    const record = await findFrappeUser(usr);
    const id = record?.name ?? usr;

    const user: AuthUser = {
      id,
      fullName: record?.full_name?.trim() || fullName,
      email: record?.email ?? "",
      imageUrl: frappeFileUrl(record?.user_image),
      roles: record ? await fetchUserRoles(id) : [],
      source: "frappe",
      signedInAt: new Date().toISOString(),
    };
    writeSession(user);
    return { ok: true, user };
  } catch (err) {
    if (err instanceof InvalidCredentialsError) {
      return { ok: false, message: err.message };
    }

    // The server never got to judge the password. Only here does the offline
    // account apply.
    const unreachable = err instanceof FrappeError && (err.isNetworkError || err.isConfigError);
    if (unreachable && (await verifyLocal(usr, password))) {
      const user: AuthUser = {
        id: LOCAL_USERNAME,
        fullName: LOCAL_USERNAME,
        email: "",
        imageUrl: null,
        roles: [],
        source: "local",
        signedInAt: new Date().toISOString(),
      };
      writeSession(user);
      return { ok: true, user };
    }

    console.error("[auth] sign-in failed:", err);
    return {
      ok: false,
      message: unreachable
        ? "Cannot reach the HRMS server. Check that it is running, then try again."
        : "Sign-in could not be completed. Please try again.",
    };
  }
}

/** Ends the Frappe session too, so `sid` does not outlive the dashboard one. */
export async function signOutUser(): Promise<void> {
  const current = readSession();
  clearSession();
  if (current?.source === "frappe") await frappeLogout();
}

// ─────────────────────────────────────────────────────────────────────────────
// Session storage
// ─────────────────────────────────────────────────────────────────────────────
// `sessionStorage` is per-tab and cleared when the tab closes, which is the
// intended lifetime. Every access is guarded: it throws outright in some
// privacy modes, and a storage error must not take the app down with it.

function isAuthUser(value: unknown): value is AuthUser {
  const u = value as Partial<AuthUser> | null;
  return (
    !!u &&
    typeof u.id === "string" &&
    typeof u.fullName === "string" &&
    (u.source === "frappe" || u.source === "local")
  );
}

export function readSession(): AuthUser | null {
  try {
    const stored = window.sessionStorage.getItem(SESSION_KEY);
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    // A session written by an older build has a different shape; drop it
    // rather than rendering the shell with half a user.
    return isAuthUser(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeSession(user: AuthUser): void {
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } catch {
    // ignore storage access errors (private browsing, quota, etc.)
  }
}

export function clearSession(): void {
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore storage access errors
  }
}
