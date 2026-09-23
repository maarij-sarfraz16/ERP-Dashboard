// Production server: the API/relay middleware plus the built `dist/` bundle,
// on one port and one origin.
//
//     npm run build && npm start
//
// In development you do not run this — `npm run dev` mounts exactly the same
// middleware inside Vite (see `vite.config.ts`), so :5173 behaves the same.

import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { createApiMiddleware } from "./api.mjs";
import { loadServerEnv } from "./env.mjs";

const env = loadServerEnv();
const api = createApiMiddleware(env);

const DIST = resolve(process.cwd(), "dist");
const PORT = Number(env.PORT ?? 5173);
const HOST = env.HOST ?? "0.0.0.0";

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
};

function serveFile(res, file, status = 200) {
  const type = CONTENT_TYPES[extname(file).toLowerCase()] ?? "application/octet-stream";
  // Hashed asset filenames may be cached hard; index.html must never be, or a
  // deploy leaves browsers on the previous bundle.
  const cache = file.startsWith(join(DIST, "assets"))
    ? "public, max-age=31536000, immutable"
    : "no-cache";
  res.writeHead(status, { "Content-Type": type, "Cache-Control": cache });
  createReadStream(file).pipe(res);
}

function serveStatic(req, res) {
  const path = decodeURIComponent((req.url ?? "/").split("?")[0]);
  const candidate = join(DIST, normalize(path));

  // Reject anything that escapes dist/ (`../`), then fall back to the SPA
  // shell so a deep link like /overview is served by the router, not a 404.
  if (candidate.startsWith(DIST) && path !== "/") {
    try {
      if (statSync(candidate).isFile()) return serveFile(res, candidate);
    } catch {
      // not a file — fall through to the shell
    }
  }

  try {
    return serveFile(res, join(DIST, "index.html"));
  } catch {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("dist/index.html is missing — run `npm run build` first.\n");
  }
}

createServer((req, res) => {
  api(req, res, () => serveStatic(req, res));
}).listen(PORT, HOST, () => {
  console.log(`[server] dashboard on http://${HOST}:${PORT}`);
  if (!env.AUTH_USER_1 && !env.AUTH_USER_2) {
    console.warn("[server] no AUTH_USER_* configured — sign-in will refuse every attempt.");
  }
});
