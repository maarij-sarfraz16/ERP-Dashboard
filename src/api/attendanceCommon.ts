// Attendance reads shared by both adapters.
//
// The Attendance table on this site is large (~570k rows), so nothing is ever
// fetched row-by-row: Frappe does the grouping via `count(name)` + `group_by`
// and a full year comes back as ~1.5k aggregate rows.

import { getList } from "./frappeClient";
import { toNumber } from "./frappeMappers";
import type { AttendancePoint } from "../data/mockData";

export interface AttendanceDailyRow {
  attendance_date: string;
  status: string | null;
  /** 0/1 flag; lateness is not a `status` value in HRMS. */
  late_entry: number | null;
  count: number | string;
}

/**
 * Which stacked band of `AttendancePoint` a row belongs to. Every ATS status
 * maps to exactly one band, so the bands add up to the record count ATS
 * reports. Lateness is deliberately NOT a band: the ATS "Late Entry" card
 * counts the `late_entry` flag on any status, so a late row still belongs to
 * its status band (Present stays Present, as on the "Total Present" card) and
 * `late` is tallied on top by `foldByDate`.
 */
export type AttendanceBand = "present" | "halfDay" | "absent" | "holiday";

export function attendanceBand(status: string | null): AttendanceBand {
  switch ((status ?? "").toLowerCase()) {
    case "present":
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
    const count = toNumber(row.count);
    const point = byDate.get(row.attendance_date) ?? emptyAttendancePoint(row.attendance_date);
    point[attendanceBand(row.status)] += count;
    // Same rows as the ATS "Late Entry" card: the flag, whatever the status.
    if (row.late_entry) point.late += count;
    byDate.set(row.attendance_date, point);
  }
  return byDate;
}

// Note: the headline present/absent/late tiles do NOT come from these rows.
// They are the ATS Number Cards, evaluated by Frappe — see `attendanceDay.ts`.
// This file only feeds the trend charts.
