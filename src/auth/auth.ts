// Dashboard sign-in. There is exactly one account; it is checked entirely in
// the browser, so this is a front door for the UI and not a security
// boundary — the Frappe API token in `.env` is what actually authorises data
// access. The password is kept as a SHA-256 digest so the plain text never
// appears in the bundle.

const USERNAME = "ADMINISTRATOR";
const PASSWORD_SHA256 = "8f570d3f3c8a951cfe70fbe1e8f5d4ff6e50bcca232d4d912d0f2eedee82e067";

const SESSION_KEY = "ats-app-session";

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Username is case-insensitive; the password is not. */
export async function verifyCredentials(username: string, password: string): Promise<boolean> {
  const nameOk = username.trim().toUpperCase() === USERNAME;
  const hash = await sha256Hex(password);
  return nameOk && hash === PASSWORD_SHA256;
}

export function readSession(): string | null {
  try {
    const stored = window.sessionStorage.getItem(SESSION_KEY);
    return stored === USERNAME ? stored : null;
  } catch {
    return null;
  }
}

export function writeSession(): void {
  try {
    window.sessionStorage.setItem(SESSION_KEY, USERNAME);
  } catch {
    // ignore storage access errors (private browsing, etc.)
  }
}

export function clearSession(): void {
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore storage access errors
  }
}

export const displayUsername = USERNAME;
