// Single entry point for every call to the Frappe / HR backend.
//
// ─────────────────────────────────────────────────────────────────────────────
// How requests get out, and why CORS no longer applies
// ─────────────────────────────────────────────────────────────────────────────
// The browser never talks to Frappe. Every call goes to `/frappe-api/...` on
// this app's own origin, where the dashboard server (`server/api.mjs`) checks
// the session cookie and then relays the request to Frappe with the API token
// attached server-side. Same-origin, so there is no preflight and `allow_cors`
// on the Frappe site is irrelevant — in dev and in production alike.
//
// That is also the security boundary: the token used to be compiled into this
// bundle, which meant anyone who opened the page could read it out of the
// JavaScript and query the HR data without signing in. It now exists only on
// the server, and a request without a valid session gets 401 here and is never
// forwarded.
//
// Under Vitest there is no dev server and no browser, so the reconciliation
// tests dial Frappe directly instead — see DIRECT_ACCESS below.
// ─────────────────────────────────────────────────────────────────────────────

import { reportAuthExpired } from "../auth/auth";
import { reportConnectionState } from "./connectionStatus";

/**
 * Node-only escape hatch for the reconciliation tests, which run outside any
 * server (`npm test`) and so cannot use the relay. `process` is undefined in
 * the browser, and these keys are read dynamically rather than through
 * `import.meta.env`, so Vite cannot inline them into the shipped bundle even
 * by accident.
 */
const nodeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  ?.env;

const DIRECT_ACCESS = nodeEnv
  ? {
      baseUrl: (nodeEnv["FRAPPE_API_BASE_URL"] ?? "").replace(/\/+$/, ""),
      key: nodeEnv["FRAPPE_API_KEY"] ?? "",
      secret: nodeEnv["FRAPPE_API_SECRET"] ?? "",
    }
  : null;

/** In the browser this is a path on our own origin, not a Frappe address. */
const BASE_URL = DIRECT_ACCESS ? DIRECT_ACCESS.baseUrl : "/frappe-api";

/** How long a single request may take before we give up on the server. */
const REQUEST_TIMEOUT_MS = 20_000;

export class FrappeError extends Error {
  readonly status: number | null;
  /** Network/CORS failures, as opposed to an HTTP error the server returned. */
  readonly isNetworkError: boolean;
  /** Misconfiguration — nothing will work, so never degrade quietly past it. */
  readonly isConfigError: boolean;
  readonly hint: string;

  constructor(
    message: string,
    options: {
      status?: number | null;
      isNetworkError?: boolean;
      isConfigError?: boolean;
      hint?: string;
    } = {},
  ) {
    super(message);
    this.name = "FrappeError";
    this.status = options.status ?? null;
    this.isNetworkError = options.isNetworkError ?? false;
    this.isConfigError = options.isConfigError ?? false;
    this.hint = options.hint ?? "";
  }
}

function assertConfigured(): void {
  // In the browser there is nothing to configure: the relay is always at
  // `/frappe-api` on this origin, and the server reports its own missing
  // credentials as a 503 with a hint. Only the Node test path needs checking.
  if (!DIRECT_ACCESS) return;

  if (!DIRECT_ACCESS.baseUrl) {
    throw new FrappeError("FRAPPE_API_BASE_URL is not set.", {
      isConfigError: true,
      hint: "Add FRAPPE_API_BASE_URL=http://<SERVER_IP>:<PORT> to .env — `npm test` reads it through vite.config.ts.",
    });
  }
  if (!DIRECT_ACCESS.key || !DIRECT_ACCESS.secret) {
    throw new FrappeError("Frappe API credentials are not set.", {
      isConfigError: true,
      hint: "Add FRAPPE_API_KEY and FRAPPE_API_SECRET to .env. Generate them in Frappe under User → API Access → Generate Keys.",
    });
  }
}

function authHeaders(): HeadersInit {
  // The browser sends no token at all — only its session cookie, which the
  // relay checks before attaching the real credentials server-side.
  if (!DIRECT_ACCESS) return { Accept: "application/json" };

  return {
    Authorization: `token ${DIRECT_ACCESS.key}:${DIRECT_ACCESS.secret}`,
    Accept: "application/json",
  };
}

/** Pulls the human-readable part out of Frappe's HTML/JSON error envelopes. */
function extractServerMessage(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as {
      exception?: string;
      message?: string;
      _server_messages?: string;
    };
    if (parsed._server_messages) {
      const messages = JSON.parse(parsed._server_messages) as string[];
      const first = JSON.parse(messages[0]) as { message?: string };
      if (first?.message) return first.message;
    }
    if (parsed.exception) return parsed.exception;
    if (parsed.message) return parsed.message;
  } catch {
    // Not JSON (Frappe serves an HTML error page for some failures) — fall
    // through to the generic status message below.
  }
  return `Frappe returned HTTP ${status}.`;
}

function hintForStatus(status: number): string {
  if (status === 401 || status === 403) {
    return "Your session may have ended — sign in again. If it persists, check FRAPPE_API_KEY / FRAPPE_API_SECRET on the server and that the linked Frappe user has read permission on this doctype.";
  }
  if (status === 404) {
    return "The doctype or whitelisted method does not exist on this site — check the spelling and that the HRMS app is installed.";
  }
  if (status >= 500) {
    return "The Frappe server raised an error. Check the bench logs (`bench --site <site> console` / `logs/web.error.log`).";
  }
  return "";
}

/**
 * Low-level wrapper around `fetch` with the base URL, auth header, timeout and
 * error normalisation already applied. Every other function in `src/api/`
 * goes through this, so hooks never repeat the boilerplate.
 */
export async function frappeFetch<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  assertConfigured();

  const url = `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const controller = new AbortController();
  // Script reports that walk child tables per row (HR Loan Summary) can take
  // longer than an ordinary list read, so callers may extend the budget.
  const { timeoutMs = REQUEST_TIMEOUT_MS, ...fetchInit } = init;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      ...fetchInit,
      signal: controller.signal,
      // Carries the session cookie to our own relay. Same-origin, so the
      // cookie goes nowhere else.
      credentials: "same-origin",
      headers: { ...authHeaders(), ...(fetchInit.headers ?? {}) },
    });
  } catch (err) {
    // fetch() only rejects for network-level problems: the dashboard server is
    // down, or the request timed out.
    const aborted = err instanceof DOMException && err.name === "AbortError";
    const where = DIRECT_ACCESS ? ` (${DIRECT_ACCESS.baseUrl})` : "";
    throw new FrappeError(
      aborted
        ? `The server did not respond within ${timeoutMs / 1000}s${where}.`
        : `Could not reach the dashboard server${where}.`,
      {
        isNetworkError: true,
        hint: aborted
          ? "The server is reachable but slow — check its load, or narrow the query."
          : "The dashboard server is not responding. Check that it is still running, then reload.",
      },
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    // 401 from our own relay means the session ended while the page was open.
    // Drop back to the login screen rather than filling the shell with errors.
    if (response.status === 401 && !DIRECT_ACCESS) reportAuthExpired();

    const body = await response.text().catch(() => "");
    throw new FrappeError(extractServerMessage(response.status, body), {
      status: response.status,
      hint: hintForStatus(response.status),
    });
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new FrappeError("Frappe returned a response that was not valid JSON.", {
      status: response.status,
      hint: "This usually means the URL resolved to an HTML page rather than an API endpoint.",
    });
  }
}

/** Frappe wraps both `/api/resource` and `/api/method` payloads in `data`. */
interface FrappeEnvelope<T> {
  data: T;
  message?: T;
}

export interface ListOptions {
  fields?: string[];
  /** Frappe filter triplets, e.g. `[["status", "=", "Active"]]`. */
  filters?: unknown[][];
  orderBy?: string;
  groupBy?: string;
  /** `0` means "no limit" in Frappe. */
  limit?: number;
  parent?: string;
}

/** `GET {base_url}/api/resource/{Doctype}` — list / aggregate reads. */
export async function getList<T>(doctype: string, options: ListOptions = {}): Promise<T[]> {
  const params = new URLSearchParams();
  if (options.fields) params.set("fields", JSON.stringify(options.fields));
  if (options.filters?.length) params.set("filters", JSON.stringify(options.filters));
  if (options.orderBy) params.set("order_by", options.orderBy);
  if (options.groupBy) params.set("group_by", options.groupBy);
  if (options.parent) params.set("parent", options.parent);
  params.set("limit_page_length", String(options.limit ?? 0));

  const body = await frappeFetch<FrappeEnvelope<T[]>>(
    `/api/resource/${encodeURIComponent(doctype)}?${params.toString()}`,
  );
  return body.data ?? [];
}

/** `GET {base_url}/api/resource/{Doctype}/{name}` — one full document. */
export async function getDoc<T>(doctype: string, name: string): Promise<T> {
  const body = await frappeFetch<FrappeEnvelope<T>>(
    `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
  );
  return body.data;
}

/** `GET {base_url}/api/method/{dotted.path}` — whitelisted server methods. */
export async function callMethod<T>(
  dottedPath: string,
  params: Record<string, unknown> = {},
  options: { timeoutMs?: number } = {},
): Promise<T> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    query.set(key, typeof value === "string" ? value : JSON.stringify(value));
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";

  const body = await frappeFetch<FrappeEnvelope<T>>(`/api/method/${dottedPath}${suffix}`, options);
  // `/api/method` returns `{message: ...}`; a few endpoints return `{data: ...}`.
  return (body.message ?? body.data) as T;
}

/** Row count for a doctype, via Frappe's whitelisted `get_count`. */
export async function getCount(doctype: string, filters: unknown[][] = []): Promise<number> {
  const result = await callMethod<number | string>("frappe.client.get_count", {
    doctype,
    filters,
  });
  return Number(result) || 0;
}

/**
 * Runs `task`, and on failure logs a warning and returns `fallback` instead of
 * throwing — for optional sections (a doctype the API user cannot read, or an
 * app that is not installed) that should not blank out the whole dashboard.
 *
 * Network/CORS failures and missing configuration are re-thrown: those mean
 * nothing will work, and degrading to zeros there would hide a broken setup
 * behind an empty-looking but plausible dashboard.
 */
export async function optional<T>(label: string, task: Promise<T>, fallback: T): Promise<T> {
  try {
    return await task;
  } catch (err) {
    if (err instanceof FrappeError && (err.isNetworkError || err.isConfigError)) throw err;
    console.warn(`[frappe] ${label} unavailable, using empty data:`, err);
    return fallback;
  }
}

/** Records success/failure so the UI can render a connection error state. */
export async function tracked<T>(task: Promise<T>): Promise<T> {
  try {
    const result = await task;
    reportConnectionState({ ok: true });
    return result;
  } catch (err) {
    reportConnectionState({
      ok: false,
      message: err instanceof Error ? err.message : "Unknown error",
      hint: err instanceof FrappeError ? err.hint : "",
    });
    throw err;
  }
}

/**
 * URL for a file path as Frappe stores it on a doc (`/files/x.png` or
 * `/private/files/x.jpg`), for use in `<img src>`.
 *
 * Private files need auth and an `<img>` tag cannot send a token header, so
 * these go through the relay like everything else: the browser requests
 * `/frappe-api/private/files/…` on this origin, the session cookie rides
 * along automatically, and the server attaches the real credentials. Works
 * the same in dev and in production now, which it did not before.
 */
export function frappeFileUrl(path: string | null | undefined): string | null {
  const trimmed = (path ?? "").trim();
  if (!trimmed || !BASE_URL) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `${BASE_URL}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}

/**
 * Where this app sends its requests, for display in diagnostics. In the
 * browser that is our own relay — the Frappe address is deliberately not
 * disclosed to the client.
 */
export const frappeBaseUrl = DIRECT_ACCESS ? DIRECT_ACCESS.baseUrl : `${BASE_URL} (this server)`;

/** True when requests pass through this app's server rather than going direct. */
export const frappeUsesRelay = !DIRECT_ACCESS;
