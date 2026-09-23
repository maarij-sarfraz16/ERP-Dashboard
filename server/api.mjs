// The server-side half of the dashboard: sign-in, sign-out, and the gated
// relay to Frappe.
//
// It is mounted two ways, and behaves identically in both:
//   • development — as Vite middleware on :5173 (see `vite.config.ts`)
//   • production  — by `server/index.mjs`, which also serves `dist/`
//
// Why the relay exists: the browser used to call Frappe directly with the API
// key and secret compiled into the bundle, so anyone who opened the page could
// read the token out of the JavaScript and query the HR data without signing
// in at all. The token now lives only here. The browser sends nothing but its
// session cookie, and a request without a valid session never reaches Frappe.
//
// This relay only forwards; it never changes anything on the Frappe server.
// Writes are refused outright (see ALLOWED_METHODS) — the dashboard is
// read-only, so the relay is too.

import { Readable } from "node:stream";
import {
  COOKIE_NAME,
  INVALID_CREDENTIALS,
  clearedCookie,
  createAuth,
  readCookie,
  sessionCookie,
} from "./auth.mjs";

/** The dashboard only ever reads. Anything else is rejected before dialling out. */
const ALLOWED_METHODS = new Set(["GET", "HEAD"]);

const MAX_LOGIN_BODY_BYTES = 4 * 1024;

function send(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_LOGIN_BODY_BYTES) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function clientAddress(req) {
  return req.socket?.remoteAddress ?? "unknown";
}

export function createApiMiddleware(env) {
  const auth = createAuth(env);

  const frappeBaseUrl = (env.FRAPPE_API_BASE_URL ?? env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");
  const apiKey = env.FRAPPE_API_KEY ?? env.VITE_FRAPPE_API_KEY ?? "";
  const apiSecret = env.FRAPPE_API_SECRET ?? env.VITE_FRAPPE_API_SECRET ?? "";
  const secure = String(env.AUTH_COOKIE_SECURE ?? "").toLowerCase() === "true";

  function currentUser(req) {
    return auth.readSession(readCookie(req.headers.cookie, COOKIE_NAME));
  }

  async function handleLogin(req, res) {
    const address = clientAddress(req);
    if (auth.throttled(address)) {
      // Deliberately the same wording as a wrong password: a throttle message
      // would tell an attacker their guesses are being counted.
      send(res, 429, { error: INVALID_CREDENTIALS });
      return;
    }

    let credentials;
    try {
      credentials = JSON.parse(await readBody(req));
    } catch {
      send(res, 400, { error: INVALID_CREDENTIALS });
      return;
    }

    const username = credentials?.username;
    const password = credentials?.password;
    if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
      send(res, 400, { error: INVALID_CREDENTIALS });
      return;
    }

    const resolved = await auth.verify(username, password);
    if (!resolved) {
      auth.recordFailure(address);
      send(res, 401, { error: INVALID_CREDENTIALS });
      return;
    }

    auth.clearFailures(address);
    const sid = auth.createSession(resolved);
    send(res, 200, { user: resolved }, { "Set-Cookie": sessionCookie(sid, { secure }) });
  }

  function handleLogout(req, res) {
    auth.destroySession(readCookie(req.headers.cookie, COOKIE_NAME));
    send(res, 200, { ok: true }, { "Set-Cookie": clearedCookie({ secure }) });
  }

  /**
   * Relays one read to Frappe with the server-held token attached. The caller
   * has already been checked; this never runs for an anonymous request.
   */
  async function relayToFrappe(req, res, user) {
    if (!ALLOWED_METHODS.has(req.method)) {
      send(res, 405, { error: "Read-only." });
      return;
    }
    if (!frappeBaseUrl || !apiKey || !apiSecret) {
      send(res, 503, {
        error: "The dashboard server is missing its Frappe credentials.",
        hint: "Set FRAPPE_API_BASE_URL, FRAPPE_API_KEY and FRAPPE_API_SECRET in .env, then restart.",
      });
      return;
    }

    const target = frappeBaseUrl + req.url.replace(/^\/frappe-api/, "");
    let upstream;
    try {
      upstream = await fetch(target, {
        method: req.method,
        headers: {
          // The same token the browser used to carry. It stops here now.
          Authorization: `token ${apiKey}:${apiSecret}`,
          Accept: req.headers.accept ?? "application/json",
        },
        signal: AbortSignal.timeout(60_000),
      });
    } catch (err) {
      // The username is safe to log; nothing secret is.
      console.error(`[relay] ${user}: ${req.method} failed —`, err?.message ?? err);
      send(res, 502, {
        error: "Could not reach the Frappe server.",
        hint: "Check FRAPPE_API_BASE_URL in .env and that the Frappe site is up.",
      });
      return;
    }

    const headers = { "Cache-Control": "no-store" };
    for (const name of ["content-type", "content-length", "content-disposition"]) {
      const value = upstream.headers.get(name);
      if (value) headers[name] = value;
    }
    res.writeHead(upstream.status, headers);
    if (!upstream.body) {
      res.end();
      return;
    }
    // Streamed rather than buffered, because employee photos come through here.
    Readable.fromWeb(upstream.body).pipe(res);
  }

  /**
   * Connect-style middleware. Returns without touching `res` for any path it
   * does not own, so Vite (dev) or the static handler (production) takes over.
   */
  return async function apiMiddleware(req, res, next) {
    const path = (req.url ?? "").split("?")[0];

    try {
      if (path === "/api/auth/login") {
        if (req.method !== "POST") return send(res, 405, { error: "Method not allowed." });
        if (!auth.configured()) {
          return send(res, 503, {
            error: "No accounts are configured on the server.",
            hint: "Set AUTH_USER_1 / AUTH_PASSWORD_HASH_1 in .env (see .env.example), then restart.",
          });
        }
        return await handleLogin(req, res);
      }

      if (path === "/api/auth/logout") {
        if (req.method !== "POST") return send(res, 405, { error: "Method not allowed." });
        return handleLogout(req, res);
      }

      if (path === "/api/auth/me") {
        const user = currentUser(req);
        if (!user) return send(res, 401, { error: "Not authenticated." });
        return send(res, 200, { user });
      }

      if (path.startsWith("/frappe-api/")) {
        const user = currentUser(req);
        if (!user) return send(res, 401, { error: "Not authenticated." });
        return await relayToFrappe(req, res, user);
      }
    } catch (err) {
      console.error("[api] unhandled error:", err?.message ?? err);
      if (!res.headersSent) send(res, 500, { error: "Server error." });
      return;
    }

    next();
  };
}
