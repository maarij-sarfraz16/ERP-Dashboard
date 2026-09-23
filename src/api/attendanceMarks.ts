// Per-employee day marks for the directory sparkline. Split from
// `employeeApi` so the window can change without re-reading the roster.
//
// Attendance is ~2k rows/day plant-wide, so a 30-day plant-wide read is
// ~60k rows / 15MB and used to trip the 20s request timeout. Instead we
// fetch only the employees currently rendered, in small batches, and keep
// what we've already fetched in a module-level cache.

import { getList } from "./frappeClient";
import type { DayMark } from "../data/employeeData";

interface RawAttendance {
  employee: string;
  attendance_date: string;
  status: string | null;
  late_entry: number | null;
}

/** employee id → { ISO date → mark } for every row in the window. */
export type AttendanceMarks = Map<string, Map<string, DayMark>>;

/**
 * Sparkline mark for one Attendance row. Holiday rows are treated as
 * "present" rather than dropped, because the sparkline renders a fixed-width
 * strip and colouring a plant holiday red would read as an absence.
 */
export function markFor(attendanceStatus: string | null, lateEntry: number | null): DayMark {
  switch ((attendanceStatus ?? "").toLowerCase()) {
    case "present":
    case "work from home":
      return lateEntry ? "late" : "present";
    case "half day":
      return "late";
    case "holiday":
      return "present";
    default:
      return "absent";
  }
}

interface CacheEntry {
  /** Window this employee's marks were fetched for (inclusive). */
  start: string;
  end: string;
  perDay: Map<string, DayMark>;
}

/** Marks already downloaded this session, per employee. */
const cache = new Map<string, CacheEntry>();

/** Ids per request — keeps the `in` filter well under URL length limits. */
const BATCH_SIZE = 100;

function covers(entry: CacheEntry | undefined, start: string, end: string): boolean {
  return Boolean(entry && entry.start <= start && entry.end >= end);
}

async function fetchBatch(ids: string[], start: string, end: string): Promise<void> {
  const rows = await getList<RawAttendance>("Attendance", {
    fields: ["employee", "attendance_date", "status", "late_entry"],
    filters: [
      ["employee", "in", ids],
      ["attendance_date", ">=", start],
      ["attendance_date", "<=", end],
      ["docstatus", "<", 2],
    ],
    limit: 0,
  });

  const fresh = new Map<string, Map<string, DayMark>>();
  for (const id of ids) fresh.set(id, new Map());
  for (const row of rows) {
    fresh.get(row.employee)?.set(row.attendance_date, markFor(row.status, row.late_entry));
  }
  for (const [id, perDay] of fresh) cache.set(id, { start, end, perDay });
}

/**
 * Marks for `ids` between `start` and `end` inclusive. Only employees whose
 * cached window doesn't already cover the request hit the server.
 */
export async function fetchAttendanceMarks(
  ids: string[],
  start: string,
  end: string,
): Promise<AttendanceMarks> {
  const missing = ids.filter((id) => !covers(cache.get(id), start, end));
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    await fetchBatch(missing.slice(i, i + BATCH_SIZE), start, end);
  }

  const marks: AttendanceMarks = new Map();
  for (const id of ids) {
    const entry = cache.get(id);
    if (entry) marks.set(id, entry.perDay);
  }
  return marks;
}

/**
 * Strip for one employee over `days`, oldest first. No Attendance row for a
 * day means no record was submitted — rendered as "absent".
 */
export function marksForDays(perDay: Map<string, DayMark> | undefined, days: string[]): DayMark[] {
  return days.map((day) => perDay?.get(day) ?? "absent");
}
