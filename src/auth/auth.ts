// Dashboard sign-in, client half.
//
// The check itself happens on the server (see `server/api.mjs`); this file only
// carries the form over and reads back the answer. There is no username, no
// password hash and no session token in the browser: the session lives in an
// HttpOnly cookie that script cannot read, and the data relay refuses any
// request that does not carry it. Clearing React state or editing anything in
// devtools therefore gets you nothing — the data is behind the server.

/** Shown for every failed sign-in, whatever the actual reason. */
const GENERIC_ERROR = "Invalid username or password.";

/**
 * Raised when the server is reachable but refuses the credentials, so the page
 * can tell "wrong password" apart from "server is down" without telling the
 * user which of the two fields was wrong.
 */
export class SignInError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SignInError";
  }
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string; hint?: string };
    return [body?.error, body?.hint].filter(Boolean).join(" ") || fallback;
  } catch {
    return fallback;
  }
}

/** Resolves to the signed-in username. Throws `SignInError` if refused. */
export async function signIn(username: string, password: string): Promise<string> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    // 503 means the server has no accounts configured — worth saying plainly,
    // since no password will ever work until .env is filled in. Everything
    // else collapses to the one generic message.
    const message =
      response.status === 503 ? await readError(response, GENERIC_ERROR) : GENERIC_ERROR;
    throw new SignInError(message);
  }

  const body = (await response.json()) as { user?: string };
  if (!body?.user) throw new SignInError(GENERIC_ERROR);
  return body.user;
}

/** Destroys the session server-side and clears the cookie. */
export async function signOut(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
  } catch {
    // The local state is cleared either way; a dropped request just leaves the
    // server entry to expire on its own.
  }
}

/** The current session's username, or null. Asked of the server, not of storage. */
export async function fetchSession(): Promise<string | null> {
  try {
    const response = await fetch("/api/auth/me", {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { user?: string };
    return body?.user ?? null;
  } catch {
    return null;
  }
}

/**
 * Broadcast when a data request comes back 401 — the session ended while the
 * page was open (server restart, or the idle cap). `useAuth` listens and drops
 * back to the login screen instead of leaving a shell full of failed fetches.
 */
export const AUTH_EXPIRED_EVENT = "ats-auth-expired";

export function reportAuthExpired(): void {
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
}
