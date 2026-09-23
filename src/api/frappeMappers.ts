// Shared translation helpers between Frappe's storage conventions and the
// shapes the dashboard components already expect.

import type { EmploymentType } from "../data/mockData";

/** Frappe suffixes Department/Company-scoped records: "Weaving - ATS". */
export function cleanDepartment(raw: string | null | undefined): string {
  if (!raw) return "Unassigned";
  return raw.replace(/\s-\s[A-Z0-9]{1,6}$/i, "").trim() || "Unassigned";
}

/**
 * Frappe's `Employment Type` is a free-form link doctype, so sites name it
 * differently ("Daily Wage", "Contract", "Piece Rate"…). Anything that is not
 * clearly permanent is bucketed as Daily Wage, which is the split the
 * dashboard visualises.
 */
export function classifyEmploymentType(raw: string | null | undefined): EmploymentType {
  if (!raw) return "Permanent";
  return /daily|wage|contract|temp|casual|piece|intern|probation/i.test(raw)
    ? "Daily Wage"
    : "Permanent";
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function isoDaysAgo(daysAgo: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() - daysAgo);
  return toIsoDate(d);
}

export function toIsoDate(d: Date): string {
  // Local-date ISO string: `toISOString()` shifts to UTC and can roll the day
  // back for timezones east of Greenwich, which would misalign "today".
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

export function today(): string {
  return toIsoDate(new Date());
}

/** First day of the month `monthsAgo` months back, as an ISO date. */
export function monthStart(monthsAgo: number, from = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth() - monthsAgo, 1);
  return toIsoDate(d);
}

export function quarterStart(from = new Date()): string {
  const d = new Date(from.getFullYear(), Math.floor(from.getMonth() / 3) * 3, 1);
  return toIsoDate(d);
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** The last 12 months, oldest first, as `{key: "2026-09", label: "Sep"}`. */
export function lastTwelveMonths(from = new Date()): { key: string; label: string }[] {
  const months: { key: string; label: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: MONTH_LABELS[d.getMonth()],
    });
  }
  return months;
}

export function monthKeyOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** `"09:15:00"` / `"2026-09-18 09:15:00"` → minutes since midnight. */
export function minutesSinceMidnight(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /(\d{1,2}):(\d{2})/.exec(value.includes(" ") ? value.split(" ")[1] ?? "" : value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatClock(value: string | null | undefined): string {
  const minutes = minutesSinceMidnight(value);
  if (minutes === null) return "—";
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
