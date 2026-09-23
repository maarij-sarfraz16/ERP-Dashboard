import type { HeadcountEmployee } from "../../api/headcountApi";

export interface CountRow {
  /** Raw value used for filtering; `""` means the field was blank in Frappe. */
  key: string;
  label: string;
  count: number;
}

/** Frappe returns blanks as null/""; the source dashboard printed "NULL". */
export const NOT_SET = "Not set";

export function labelOf(value: string): string {
  return value || NOT_SET;
}

/** Counts employees by a field, largest first, blanks last among equals. */
export function countBy(
  employees: HeadcountEmployee[],
  pick: (e: HeadcountEmployee) => string,
  label: (value: string) => string = labelOf,
): CountRow[] {
  const counts = new Map<string, number>();
  for (const e of employees) {
    const key = pick(e);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, label: label(key), count }))
    .sort((a, b) => b.count - a.count || (a.key ? 0 : 1) - (b.key ? 0 : 1));
}

export function fmtInt(n: number): string {
  return n.toLocaleString("en-US");
}

export function fmtPct(part: number, whole: number): string {
  if (whole <= 0) return "0%";
  const pct = (part / whole) * 100;
  if (pct > 0 && pct < 0.1) return "<0.1%";
  // Keep near-0 and near-100 shares from rounding to a misleading 0% / 100%.
  const precise = (pct > 0 && pct < 1) || (pct > 99 && pct < 100);
  return `${precise ? pct.toFixed(1) : Math.round(pct)}%`;
}

export function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** Fixed colour per known value so a status/mode keeps its colour across filters. */
export const TONE: Record<string, string> = {
  Active: "var(--hc-green)",
  Inactive: "var(--hc-gold)",
  Left: "var(--hc-slate)",
  Bank: "var(--hc-green)",
  Cash: "var(--hc-gold)",
  Male: "var(--hc-indigo)",
  Female: "var(--hc-red)",
  Present: "var(--hc-green)",
  Absent: "var(--hc-red)",
  "On Leave": "var(--hc-gold)",
  "Half Day": "var(--hc-indigo)",
  "Work From Home": "var(--hc-plum)",
  Holiday: "var(--hc-slate)",
};

const CYCLE = ["var(--hc-green)", "var(--hc-indigo)", "var(--hc-gold)", "var(--hc-red)", "var(--hc-plum)"];

export function toneFor(key: string, index: number): string {
  if (!key) return "var(--hc-muted-fill)";
  return TONE[key] ?? CYCLE[index % CYCLE.length];
}
