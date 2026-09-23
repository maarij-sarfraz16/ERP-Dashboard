// Minimal `.env` reader, so the production server needs no dotenv dependency.
// Vite has its own (`loadEnv`) and uses that; this is for `node server/…`.
//
// Real environment variables win over the file, which is what you want when
// the app is started by a service manager that sets them itself.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadServerEnv(dir = process.cwd()) {
  const parsed = {};
  let raw = "";
  try {
    raw = readFileSync(resolve(dir, ".env"), "utf8");
  } catch {
    return { ...process.env };
  }

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }

  return { ...parsed, ...process.env };
}
