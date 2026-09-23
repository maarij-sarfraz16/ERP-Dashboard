// The date window the directory sparkline renders. Pure helpers — no I/O —
// so the resolved window can be unit-tested and shared by the API layer.

import { toIsoDate } from "../api/frappeMappers";

/** Rolling window ending today. Only two sizes, so the query stays small. */
export type AttendanceWindow = 15 | 30;

export const WINDOW_PRESETS: readonly AttendanceWindow[] = [15, 30];

export const DEFAULT_ATTENDANCE_WINDOW: AttendanceWindow = 15;

export interface ResolvedRange {
  start: string;
  end: string;
  /** Every calendar day from `start` to `end` inclusive, oldest first. */
  days: string[];
  /** Human label, e.g. "1 Aug – 31 Aug 2026 · 31 days". */
  label: string;
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function daysBetween(start: string, end: string): string[] {
  const days: string[] = [];
  const cursor = parseIso(start);
  const last = parseIso(end);
  while (cursor <= last) {
    days.push(toIsoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function shortDate(iso: string, withYear: boolean): string {
  return parseIso(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

export function resolveRange(windowDays: AttendanceWindow, now = new Date()): ResolvedRange {
  const end = toIsoDate(now);
  const d = new Date(now);
  d.setDate(d.getDate() - (windowDays - 1));
  const start = toIsoDate(d);

  const days = daysBetween(start, end);
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const label = `${shortDate(start, !sameYear)} – ${shortDate(end, true)} · ${days.length} days`;
  return { start, end, days, label };
}
