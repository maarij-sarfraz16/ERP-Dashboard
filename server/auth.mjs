// Credential check + session store for the dashboard's two fixed accounts.
//
// There is no user table and no registration: the two accounts come from
// server-side environment variables (AUTH_USER_1/AUTH_PASSWORD_HASH_1 and
// AUTH_USER_2/AUTH_PASSWORD_HASH_2). Only bcrypt hashes are ever stored —
// generate them with `npm run hash-password`, which never writes the plain
// text anywhere.
//
// Nothing in this file is reachable from the browser bundle; it runs only in
// Node, behind the API middleware.

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

export const COOKIE_NAME = "ats_sid";

/** The one message the client is ever shown for a failed sign-in. */
export const INVALID_CREDENTIALS = "Invalid username or password.";

/**
 * Server-side idle cap. The cookie itself is a browser-session cookie (no
 * Max-Age), so closing the browser already ends the session; this only stops
 * abandoned sessions living in memory forever.
 */
const IDLE_TIMEOUT_MS = 12 * 60 * 60 * 1000;

/** Brute-force throttle: attempts allowed per client address per window. */
const MAX_ATTEMPTS = 10;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

/**
 * Compared against when the username is unknown, so a wrong username costs the
 * same time as a wrong password and the two cannot be told apart.
 */
const DECOY_HASH = bcrypt.hashSync(randomBytes(32).toString("hex"), 12);

function readAccounts(env) {
  const accounts = new Map();
  for (const slot of [1, 2]) {
    const username = (env[`AUTH_USER_${slot}`] ?? "").trim();
    const hash = (env[`AUTH_PASSWORD_HASH_${slot}`] ?? "").trim();
    if (!username || !hash) continue;
    if (!/^\$2[aby]\$/.test(hash)) {
      // Never echo the value — it is a secret even when it is malformed.
      throw new Error(
        `AUTH_PASSWORD_HASH_${slot} is not a bcrypt hash. Generate it with \`npm run hash-password\`.`,
      );
    }
    accounts.set(username.toLowerCase(), { username, hash });
  }
  return accounts;
}

export function createAuth(env) {
  const accounts = readAccounts(env);
  /** sid -> { username, lastSeen } */
  const sessions = new Map();
  /** client address -> { count, resetAt } */
  const attempts = new Map();

  function configured() {
    return accounts.size > 0;
  }

  function throttled(address) {
    const now = Date.now();
    const entry = attempts.get(address);
    if (!entry || now > entry.resetAt) return false;
    return entry.count >= MAX_ATTEMPTS;
  }

  function recordFailure(address) {
    const now = Date.now();
    const entry = attempts.get(address);
    if (!entry || now > entry.resetAt) {
      attempts.set(address, { count: 1, resetAt: now + ATTEMPT_WINDOW_MS });
      return;
    }
    entry.count += 1;
  }

  /**
   * Resolves to the account's display name, or null. Always runs one bcrypt
   * comparison, so timing does not reveal whether the username exists.
   */
  async function verify(username, password) {
    const key = String(username ?? "").trim().toLowerCase();
    const account = accounts.get(key) ?? null;
    const ok = await bcrypt.compare(String(password ?? ""), account ? account.hash : DECOY_HASH);
    return ok && account ? account.username : null;
  }

  function createSession(username) {
    const sid = randomBytes(32).toString("hex");
    sessions.set(sid, { username, lastSeen: Date.now() });
    return sid;
  }

  /** The signed-in username for this request, or null. Refreshes idle time. */
  function readSession(sid) {
    if (!sid) return null;
    const entry = sessions.get(sid);
    if (!entry) return null;
    if (Date.now() - entry.lastSeen > IDLE_TIMEOUT_MS) {
      sessions.delete(sid);
      return null;
    }
    entry.lastSeen = Date.now();
    return entry.username;
  }

  function destroySession(sid) {
    if (sid) sessions.delete(sid);
  }

  return {
    configured,
    accountCount: () => accounts.size,
    throttled,
    recordFailure,
    clearFailures: (address) => attempts.delete(address),
    verify,
    createSession,
    readSession,
    destroySession,
  };
}

/** Reads one cookie out of a raw `Cookie:` header. */
export function readCookie(header, name) {
  for (const part of String(header ?? "").split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

/**
 * A browser-session cookie: HttpOnly so script cannot read it, SameSite=Lax so
 * it is not sent on cross-site requests, and no Max-Age so it dies with the
 * browser. `secure` must stay off while the dashboard is served over plain
 * HTTP on the LAN — a Secure cookie is simply dropped there, which would make
 * sign-in appear to succeed and then fail.
 */
export function sessionCookie(sid, { secure }) {
  const flags = ["Path=/", "HttpOnly", "SameSite=Lax"];
  if (secure) flags.push("Secure");
  return `${COOKIE_NAME}=${sid}; ${flags.join("; ")}`;
}

export function clearedCookie({ secure }) {
  const flags = ["Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (secure) flags.push("Secure");
  return `${COOKIE_NAME}=; ${flags.join("; ")}`;
}
