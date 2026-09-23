// Sign-in against the Frappe user table.
//
// Accounts live in the Frappe database (the `User` doctype, with password
// hashes in `__Auth`) — not in this bundle. `/api/method/login` is the only
// endpoint that can check a password, so that is what the dashboard calls.
//
// Two things are worth knowing before changing anything here:
//
//  1. Every request from `frappeClient` carries `Authorization: token …`.
//     That does NOT short-circuit the login check — Frappe still validates
//     `usr`/`pwd` and answers 401 when they are wrong (verified against
//     10.1.1.98). So login can share the ordinary client and its dev proxy.
//
//  2. For the same reason, `frappe.auth.get_logged_user` is useless here: it
//     reports the *token's* user, not the one who just signed in. The signed-in
//     identity therefore comes from the login response plus a lookup below.

import { FrappeError, frappeFetch, getDoc } from "./frappeClient";

/** A row of Frappe's `User` doctype, as the dashboard uses it. */
export interface FrappeUserRecord {
  /** Primary key — usually the email address. */
  name: string;
  full_name: string;
  email: string;
  username: string;
  user_image: string | null;
  enabled: 0 | 1;
  last_login: string | null;
}

const USER_FIELDS = [
  "name",
  "full_name",
  "email",
  "username",
  "user_image",
  "enabled",
  "last_login",
] as const;

export class InvalidCredentialsError extends Error {
  constructor(message = "Incorrect username or password.") {
    super(message);
    this.name = "InvalidCredentialsError";
  }
}

interface LoginResponse {
  message?: string;
  full_name?: string;
}

/**
 * Checks `usr` / `pwd` against the Frappe database.
 *
 * `usr` may be the user id (email), the username, or the email address —
 * Frappe resolves all three. Throws `InvalidCredentialsError` when the pair is
 * rejected, and the usual `FrappeError` when the server cannot be reached.
 *
 * A successful call also updates `last_login` on the User record and returns a
 * `sid` session cookie, so the sign-in is recorded server-side rather than only
 * in this tab.
 */
export async function frappeLogin(usr: string, pwd: string): Promise<string> {
  try {
    const body = await frappeFetch<LoginResponse>("/api/method/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Same-origin through the dev proxy, so the `sid` cookie is stored for
      // this app's origin. Harmless when the request is same-origin already.
      credentials: "include",
      body: JSON.stringify({ usr, pwd }),
    });
    return body.full_name?.trim() || usr;
  } catch (err) {
    // 401 is the documented answer for a wrong password; 417 comes back when
    // the account is disabled or otherwise refused. Both are "try again",
    // not "the backend is broken", so they must not surface as a config error.
    if (err instanceof FrappeError && (err.status === 401 || err.status === 417)) {
      throw new InvalidCredentialsError(
        err.status === 417 ? "That account cannot sign in. Contact your administrator." : undefined,
      );
    }
    throw err;
  }
}

/** Ends the Frappe session behind the `sid` cookie. Failures are ignored. */
export async function frappeLogout(): Promise<void> {
  try {
    await frappeFetch("/api/method/logout", { credentials: "include" });
  } catch {
    // Signing out of the dashboard must succeed even if the server does not
    // answer — the local session is cleared either way.
  }
}

/**
 * The `User` row behind whatever the person typed into the username box.
 *
 * Frappe accepts the user id, the username or the email at login but does not
 * say which one matched, so all three are tried here with `or_filters`.
 * Returns `null` rather than throwing when the lookup fails: the password was
 * already accepted at that point, and a missing profile should degrade to a
 * plainer sidebar, not block the sign-in.
 */
export async function findFrappeUser(usr: string): Promise<FrappeUserRecord | null> {
  const typed = usr.trim();
  if (!typed) return null;

  const params = new URLSearchParams({
    fields: JSON.stringify(USER_FIELDS),
    or_filters: JSON.stringify([
      ["name", "=", typed],
      ["username", "=", typed],
      ["email", "=", typed],
    ]),
    limit_page_length: "1",
  });

  try {
    const body = await frappeFetch<{ data: FrappeUserRecord[] }>(
      `/api/resource/User?${params.toString()}`,
    );
    return body.data?.[0] ?? null;
  } catch (err) {
    console.warn("[auth] could not read the User record:", err);
    return null;
  }
}

/** Role names granted to a user, for role-aware UI later. Never throws. */
export async function fetchUserRoles(userId: string): Promise<string[]> {
  try {
    const doc = await getDoc<{ roles?: { role: string }[] }>("User", userId);
    return (doc.roles ?? []).map((r) => r.role).filter(Boolean);
  } catch (err) {
    console.warn("[auth] could not read roles:", err);
    return [];
  }
}
