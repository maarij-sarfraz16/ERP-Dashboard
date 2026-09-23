// Single entry point for every call to the Frappe / ERPNext backend.
//
// ─────────────────────────────────────────────────────────────────────────────
// CORS — read this before debugging a failed request
// ─────────────────────────────────────────────────────────────────────────────
// The browser blocks cross-origin XHR unless the Frappe server explicitly
// allows this app's origin. A correct API key/secret does NOT help: the
// preflight is rejected before the credentials are ever looked at, and the
// only symptom you get in the console is an opaque "TypeError: Failed to
// fetch" / "blocked by CORS policy".
//
// On the Frappe host, edit `sites/common_site_config.json` (or the individual
// `sites/<site>/site_config.json`) and add this app's EXACT origin —
// protocol + host + port, no trailing slash:
//
//     "allow_cors": ["http://localhost:5173", "http://10.1.1.98:5173"]
//
// Then restart: `bench restart` (production) or restart `bench start` (dev).
// Every origin the dashboard is served from needs its own entry — Vite's dev
// server (:5173) and the built `dist/` preview (:4173) are different origins,
// as is the same host reached by IP instead of by `localhost`.
//
// As of this writing the site at 10.1.1.98:8000 returns no
// Access-Control-Allow-Origin header, i.e. `allow_cors` is NOT configured. In
// development that does not matter, because requests are routed through Vite's
// `/frappe-api` proxy (see `vite.config.ts`) and are therefore same-origin. A
// PRODUCTION BUILD HAS NO PROXY, so `allow_cors` must be set before deploying.
// ─────────────────────────────────────────────────────────────────────────────

import { reportConnectionState } from "./connectionStatus";

const CONFIGURED_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");
const API_KEY = import.meta.env.VITE_FRAPPE_API_KEY ?? "";
const API_SECRET = import.meta.env.VITE_FRAPPE_API_SECRET ?? "";

/**
 * In dev, requests go to Vite's `/frappe-api` proxy (see `vite.config.ts`),
 * which forwards them to `VITE_API_BASE_URL` server-side and sidesteps CORS
 * entirely. Set `VITE_USE_DEV_PROXY=false` to call Frappe directly instead —
 * that needs `allow_cors` on the server, as a production build always does.
 */
const USE_DEV_PROXY =
  import.meta.env.DEV && import.meta.env.VITE_USE_DEV_PROXY !== "false" && Boolean(CONFIGURED_URL);

const BASE_URL = USE_DEV_PROXY ? "/frappe-api" : CONFIGURED_URL;

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
  if (!BASE_URL) {
    throw new FrappeError("VITE_API_BASE_URL is not set.", {
      isConfigError: true,
      hint: "Add VITE_API_BASE_URL=http://<SERVER_IP>:<PORT> to .env and restart the dev server (Vite only reads .env at startup).",
    });
  }
  if (!API_KEY || !API_SECRET) {
    throw new FrappeError("Frappe API credentials are not set.", {
      isConfigError: true,
      hint: "Add VITE_FRAPPE_API_KEY and VITE_FRAPPE_API_SECRET to .env. Generate them in Frappe under User → API Access → Generate Keys.",
    });
  }
}

function authHeaders(): HeadersInit {
  return {
    // Token auth is required for cross-origin calls: session cookies are not
    // sent to a different origin/port, so cookie auth silently 403s here.
    Authorization: `token ${API_KEY}:${API_SECRET}`,
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
    return "Check VITE_FRAPPE_API_KEY / VITE_FRAPPE_API_SECRET, and that the linked Frappe user has read permission on this doctype.";
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
export async function frappeFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  assertConfigured();

  const url = `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { ...authHeaders(), ...(init.headers ?? {}) },
    });
  } catch (err) {
    // fetch() only rejects for network-level problems: server down, wrong
    // IP/port, DNS failure, timeout, or a CORS preflight rejection. The
    // browser deliberately hides which one it was.
    const aborted = err instanceof DOMException && err.name === "AbortError";
    throw new FrappeError(
      aborted
        ? `Frappe did not respond within ${REQUEST_TIMEOUT_MS / 1000}s (${CONFIGURED_URL}).`
        : `Could not reach the Frappe server at ${CONFIGURED_URL}.`,
      {
        isNetworkError: true,
        hint: aborted
          ? "The server is reachable but slow — check its load, or narrow the query."
          : USE_DEV_PROXY
            ? "Vite's dev proxy could not reach the server — check that VITE_API_BASE_URL is right and the Frappe site is up (CORS is not involved in proxy mode)."
            : "Either the server is down / the IP:port in VITE_API_BASE_URL is wrong, or the server's site config is missing this app's origin under `allow_cors` (see the note at the top of this file).",
      },
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
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

/** `GET {base_url}/api/method/{dotted.path}` — whitelisted server methods. */
export async function callMethod<T>(
  dottedPath: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    query.set(key, typeof value === "string" ? value : JSON.stringify(value));
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";

  const body = await frappeFetch<FrappeEnvelope<T>>(`/api/method/${dottedPath}${suffix}`);
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

/** The Frappe site this app talks to, for display in diagnostics. */
export const frappeBaseUrl = CONFIGURED_URL;

/** True when requests are tunnelled through Vite's dev proxy. */
export const frappeUsesDevProxy = USE_DEV_PROXY;
