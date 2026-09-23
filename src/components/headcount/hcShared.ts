import type { HeadcountEmployee } from "../../data/employeeData";

export interface CountRow {
  /** Raw value used for filtering; `""` means the field was blank in Frappe. */
  key: string;
  label: string;
  count: number;
}

/** Frappe returns blanks as null/""; the source dashboard printed "NULL". */
export const NOT_SET = "Not set";
/** Blank `salary_mode` — neither Bank nor Cash chosen on the employee record. */
export const NO_SALARY_MODE = "No salary mode";
/** `salary_mode` is Bank but `bank_name` is blank on the employee record. */
export const NO_BANK_NAME = "No bank name";

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

/**
 * Employees by bank, for the "Salary Payment Mode · Bank" card.
 *
 * Only employees whose `salary_mode` is `Bank` are counted — that is Frappe's
 * own rule (`bank_name` is shown on the Employee form only when the salary
 * mode is Bank), so cash-paid staff, who have no bank by definition, are not
 * reported as a bank that is "Not set".
 *
 * `bank_name` is free text in Frappe (a Data field, no Bank master), so the
 * same bank appears under differently-cased spellings. Rows are grouped the
 * way the database groups them — its collation compares text case- and
 * trailing-space-insensitively — and labelled with the spelling HR used most
 * often. Genuinely different names stay separate; nothing is renamed.
 * Blank bank names are one "No bank name" row, ranked last.
 */
export function bankBreakdown(employees: HeadcountEmployee[]): CountRow[] {
  const groups = new Map<string, { count: number; spellings: Map<string, number> }>();
  for (const e of employees) {
    if (e.salaryMode !== "Bank") continue;
    const key = e.bankName.trimEnd().toLowerCase();
    const group = groups.get(key) ?? { count: 0, spellings: new Map<string, number>() };
    group.count += 1;
    group.spellings.set(e.bankName, (group.spellings.get(e.bankName) ?? 0) + 1);
    groups.set(key, group);
  }
  return [...groups.entries()]
    .map(([key, { count, spellings }]) => {
      const label = [...spellings.entries()].sort((a, b) => b[1] - a[1])[0][0];
      return { key, label: label || NO_BANK_NAME, count };
    })
    .sort((a, b) => (a.key ? 0 : 1) - (b.key ? 0 : 1) || b.count - a.count);
}

/** One ordinal band, e.g. ages 25–34. `max` is inclusive; omit it for the open top band. */
export interface YearBand {
  label: string;
  min: number;
  max?: number;
}

export const AGE_BANDS: YearBand[] = [
  { label: "Under 25", min: 0, max: 24 },
  { label: "25 – 34", min: 25, max: 34 },
  { label: "35 – 44", min: 35, max: 44 },
  { label: "45 – 54", min: 45, max: 54 },
  { label: "55 – 59", min: 55, max: 59 },
  { label: "60 and over", min: 60 },
];

export const SERVICE_BANDS: YearBand[] = [
  { label: "Under 1 year", min: 0, max: 0 },
  { label: "1 – 2 years", min: 1, max: 2 },
  { label: "3 – 5 years", min: 3, max: 5 },
  { label: "6 – 10 years", min: 6, max: 10 },
  { label: "11 – 20 years", min: 11, max: 20 },
  { label: "Over 20 years", min: 21 },
];

/**
 * Headcount per band, in band order (not by size — the axis is ordinal).
 * Employees whose date is blank or invalid land in a final "Not set" row so
 * the rows still add up to the headcount; empty bands are kept so the chart
 * shape is comparable across filters.
 */
export function countByBand(
  employees: HeadcountEmployee[],
  dateOf: (e: HeadcountEmployee) => string,
  bands: YearBand[],
  asOf: string,
): CountRow[] {
  const counts = new Array<number>(bands.length).fill(0);
  let notSet = 0;
  for (const e of employees) {
    const years = yearsBetween(dateOf(e), asOf);
    const i = years === null ? -1 : bands.findIndex((b) => years >= b.min && (b.max === undefined || years <= b.max));
    if (i < 0) notSet += 1;
    else counts[i] += 1;
  }
  const rows = bands.map((b, i) => ({ key: b.label, label: b.label, count: counts[i] }));
  if (notSet > 0) rows.push({ key: "", label: NOT_SET, count: notSet });
  return rows;
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

/**
 * Completed years from `fromIso` to `toIso` (birthday-style: the year only
 * counts once the anniversary has passed). Null when `fromIso` is blank.
 */
export function yearsBetween(fromIso: string, toIso: string): number | null {
  if (!fromIso) return null;
  const from = new Date(`${fromIso}T00:00:00`);
  const to = new Date(`${toIso}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  let years = to.getFullYear() - from.getFullYear();
  const beforeAnniversary =
    to.getMonth() < from.getMonth() ||
    (to.getMonth() === from.getMonth() && to.getDate() < from.getDate());
  if (beforeAnniversary) years -= 1;
  return years;
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
