// Browser-console diagnostic. Open the dashboard, press F12 and run:
//
//     await testFrappeConnection()
//
// It walks the same path a real request takes — reachability, then auth, then
// doctype permissions — and prints which step failed, so a blank dashboard can
// be traced to the server, the keys or the CORS config in one call.

import { callMethod, frappeBaseUrl, frappeFetch, frappeUsesDevProxy, getCount } from "./frappeClient";
import { FrappeError } from "./frappeClient";

export interface ConnectionCheck {
  step: string;
  ok: boolean;
  detail: string;
}

export interface ConnectionReport {
  baseUrl: string;
  ok: boolean;
  checks: ConnectionCheck[];
}

const DOCTYPES_USED = ["Employee", "Attendance", "Salary Slip", "Shift Type"];

function describe(err: unknown): string {
  if (err instanceof FrappeError) {
    return err.hint ? `${err.message} — ${err.hint}` : err.message;
  }
  return err instanceof Error ? err.message : String(err);
}

export async function testFrappeConnection(): Promise<ConnectionReport> {
  const checks: ConnectionCheck[] = [];

  // 1. Is the origin reachable at all, and does CORS let us read the response?
  try {
    await frappeFetch<unknown>("/api/method/ping");
    checks.push({
      step: frappeUsesDevProxy ? "reachable (via Vite proxy)" : "reachable + CORS",
      ok: true,
      detail: `${frappeBaseUrl} responded`,
    });
  } catch (err) {
    checks.push({
      step: frappeUsesDevProxy ? "reachable (via Vite proxy)" : "reachable + CORS",
      ok: false,
      detail: describe(err),
    });
    return report(checks);
  }

  // 2. Do the API key/secret resolve to a real user?
  try {
    const user = await callMethod<string>("frappe.auth.get_logged_user");
    const ok = Boolean(user) && user !== "Guest";
    checks.push({
      step: "authenticated",
      ok,
      detail: ok
        ? `logged in as ${user}`
        : "request went through as Guest — the Authorization token was not accepted",
    });
    if (!ok) return report(checks);
  } catch (err) {
    checks.push({ step: "authenticated", ok: false, detail: describe(err) });
    return report(checks);
  }

  // 3. Can that user actually read the doctypes the dashboard needs?
  for (const doctype of DOCTYPES_USED) {
    try {
      const count = await getCount(doctype);
      checks.push({ step: `read ${doctype}`, ok: true, detail: `${count} record(s)` });
    } catch (err) {
      checks.push({ step: `read ${doctype}`, ok: false, detail: describe(err) });
    }
  }

  return report(checks);
}

function report(checks: ConnectionCheck[]): ConnectionReport {
  const result: ConnectionReport = {
    baseUrl: frappeBaseUrl || "(VITE_API_BASE_URL not set)",
    ok: checks.every((c) => c.ok),
    checks,
  };
  console.log(
    `[frappe] ${result.ok ? "✅ all checks passed" : "❌ check failed"} — ${result.baseUrl}` +
      (frappeUsesDevProxy ? " (via Vite /frappe-api proxy)" : " (direct, needs allow_cors)"),
  );
  console.table(checks);
  return result;
}

declare global {
  interface Window {
    testFrappeConnection: typeof testFrappeConnection;
  }
}

/** Called once from `main.tsx` so the helper is on `window` in every build. */
export function registerConnectionTest(): void {
  window.testFrappeConnection = testFrappeConnection;
}
