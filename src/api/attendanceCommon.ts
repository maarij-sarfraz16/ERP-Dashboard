// Attendance reads shared by both adapters.
//
// The Attendance table on this site is large (~570k rows), so nothing is ever
// fetched row-by-row: Frappe does the grouping via `count(name)` + `group_by`
// and a full year comes back as ~1.5k aggregate rows.

import { getList } from "./frappeClient";
import { isoDaysAgo, toNumber } from "./frappeMappers";
import type { AttendancePoint } from "../data/mockData";

export interface AttendanceDailyRow {
  attendance_date: string;
  status: string | null;
  /** 0/1 flag; lateness is not a `status` value in HRMS. */
  late_entry: number | null;
  count: number | string;
}

/**
 * Which field of `AttendancePoint` a row belongs to. Every ATS status maps to
 * exactly one band, so the bands add up to the record count ATS reports.
 * Lateness is not a `status` in HRMS — the `late_entry` flag carries it, and
 * it only splits Present (an Absent row can carry the flag too; it stays
 * absent).
 */
export type AttendanceBand = "present" | "late" | "halfDay" | "absent" | "holiday";

export function attendanceBand(status: string | null, lateEntry: number | null): AttendanceBand {
  switch ((status ?? "").toLowerCase()) {
    case "present":
      return lateEntry ? "late" : "present";
    case "work from home":
      return "present";
    case "half day":
      return "halfDay";
    case "holiday":
      return "holiday";
    default:
      // "Absent", "On Leave", and any site-specific status.
      return "absent";
  }
}

export function emptyAttendancePoint(date: string): AttendancePoint {
  return { date, present: 0, late: 0, halfDay: 0, absent: 0, holiday: 0 };
}

/** One aggregate query covering everything the dashboard needs. */
export function fetchDailyAttendance(sinceIso: string): Promise<AttendanceDailyRow[]> {
  return getList<AttendanceDailyRow>("Attendance", {
    fields: ["attendance_date", "status", "late_entry", "count(name) as count"],
    filters: [
      ["attendance_date", ">=", sinceIso],
      // Submitted records only, as ATS's own attendance cards and charts count.
      ["docstatus", "=", 1],
    ],
    groupBy: "attendance_date, status, late_entry",
    orderBy: "attendance_date asc",
    limit: 0,
  });
}

/** Collapses the aggregate rows into one `AttendancePoint` per calendar date. */
export function foldByDate(rows: AttendanceDailyRow[]): Map<string, AttendancePoint> {
  const byDate = new Map<string, AttendancePoint>();
  for (const row of rows) {
    const band = attendanceBand(row.status, row.late_entry);
    const point = byDate.get(row.attendance_date) ?? emptyAttendancePoint(row.attendance_date);
    point[band] += toNumber(row.count);
    byDate.set(row.attendance_date, point);
  }
  return byDate;
}

/** Total rows per date — used to judge completeness. */
export function totalsByDate(rows: AttendanceDailyRow[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.attendance_date, (totals.get(row.attendance_date) ?? 0) + toNumber(row.count));
  }
  return totals;
}

/** A day is treated as fully posted once it covers this much of the roster. */
const COVERAGE_THRESHOLD = 0.9;

/**
 * The most recent day whose attendance is actually finished being entered.
 *
 * Two traps this avoids:
 *  - Attendance is posted a day in arrears, so querying "today" returns no
 *    rows for most of the working day and the presence KPIs would read 0%.
 *  - The most recent day is often *partially* entered — presences get logged
 *    before absences are marked. Taking it at face value understates presence
 *    and badly understates absence.
 *
 * So: walk backwards to the latest day whose total record count covers at
 * least 90% of the active roster. Falls back to the latest day with any rows
 * when nothing clears the bar (a small or newly-populated site).
 */
export function latestCompleteDay(
  byDate: Map<string, AttendancePoint>,
  totals: Map<string, number>,
  rosterSize: number,
): AttendancePoint | null {
  const dates = [...byDate.keys()].sort().reverse();
  if (dates.length === 0) return null;

  if (rosterSize > 0) {
    const needed = rosterSize * COVERAGE_THRESHOLD;
    for (const date of dates) {
      if ((totals.get(date) ?? 0) >= needed) return byDate.get(date) ?? null;
    }
  }
  return byDate.get(dates[0]) ?? null;
}

/** Window for the KPI tiles — a week is enough to find the last posted day. */
export function recentAttendanceWindowStart(): string {
  return isoDaysAgo(7);
}
