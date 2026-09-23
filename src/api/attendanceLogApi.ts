// Per-day attendance log: every Attendance row for one calendar date, mapped
// to the `CheckIn` shape the table renders.
//
// One day on this site is ~2.3k rows (one per active employee), which is small
// enough to pull in a single request and filter client-side — far cheaper than
// re-querying Frappe on every chip click.

import { getList, optional } from "./frappeClient";
import { attendanceBand, type AttendanceBand } from "./attendanceCommon";
import { cleanDepartment, formatClock, minutesSinceMidnight } from "./frappeMappers";
import type { AttendanceStatus, CheckIn } from "../data/mockData";

export interface AttendanceDetailRow {
  name: string;
  employee: string;
  employee_name: string | null;
  department: string | null;
  attendance_date: string;
  status: string | null;
  late_entry: number | null;
  in_time: string | null;
  out_time: string | null;
  shift: string | null;
}

export interface ShiftTypeRow {
  name: string;
  start_time: string | null;
  end_time: string | null;
}

export interface AttendanceLog {
  date: string;
  rows: CheckIn[];
}

const DETAIL_FIELDS = [
  "name",
  "employee",
  "employee_name",
  "department",
  "attendance_date",
  "status",
  "late_entry",
  "in_time",
  "out_time",
  "shift",
];

/** Shift Types change rarely, so one fetch per page load is plenty. */
let shiftTypesPromise: Promise<ShiftTypeRow[]> | null = null;

function fetchShiftTypes(): Promise<ShiftTypeRow[]> {
  shiftTypesPromise ??= optional(
    "Shift types",
    getList<ShiftTypeRow>("Shift Type", {
      fields: ["name", "start_time", "end_time"],
      limit: 0,
    }),
    [] as ShiftTypeRow[],
  );
  return shiftTypesPromise;
}

export async function fetchAttendanceLog(date: string): Promise<AttendanceLog> {
  const [rows, shifts] = await Promise.all([
    getList<AttendanceDetailRow>("Attendance", {
      fields: DETAIL_FIELDS,
      // Every submitted record for the day, Holiday included, so the log's
      // row count matches the ATS Attendance list for that date.
      filters: [
        ["attendance_date", "=", date],
        ["docstatus", "=", 1],
      ],
      orderBy: "employee_name asc",
      limit: 0,
    }),
    fetchShiftTypes(),
  ]);
  return { date, rows: toCheckIns(rows, shifts) };
}

const STATUS_OF_BAND: Record<AttendanceBand, AttendanceStatus> = {
  present: "on-time",
  late: "late",
  halfDay: "half-day",
  absent: "absent",
  holiday: "holiday",
};

export function toCheckIns(rows: AttendanceDetailRow[], shifts: ShiftTypeRow[]): CheckIn[] {
  const shiftStart = new Map(shifts.map((s) => [s.name, minutesSinceMidnight(s.start_time)]));
  const shiftLabel = new Map(
    shifts.map((s) => [s.name, `${formatClock(s.start_time)} – ${formatClock(s.end_time)}`]),
  );

  return rows.map((row) => {
    const status = STATUS_OF_BAND[attendanceBand(row.status, row.late_entry)];

    const start = row.shift ? shiftStart.get(row.shift) ?? null : null;
    const inMinutes = minutesSinceMidnight(row.in_time);
    const minutesLate =
      status === "late" && start !== null && inMinutes !== null
        ? Math.max(0, inMinutes - start)
        : 0;

    return {
      id: row.name,
      employeeName: row.employee_name?.trim() || row.employee,
      department: cleanDepartment(row.department),
      shift: (row.shift && shiftLabel.get(row.shift)) || row.shift || "—",
      checkIn: formatClock(row.in_time),
      checkOut: row.out_time ? formatClock(row.out_time) : null,
      status,
      minutesLate,
    };
  });
}
