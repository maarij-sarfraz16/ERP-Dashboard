// Builds `EmployeeApiResponse` (the exact contract `useEmployeeData` returned
// from mock data) out of Frappe HRMS doctypes: Employee + Attendance.

import { frappeFileUrl, getCount, getList, optional } from "./frappeClient";
import {
  fetchDailyAttendance,
  foldByDate,
  latestCompleteDay,
  recentAttendanceWindowStart,
  totalsByDate,
  type AttendanceDailyRow,
} from "./attendanceCommon";
import {
  classifyEmploymentType,
  cleanDepartment,
  initialsOf,
  isoDaysAgo,
  lastTwelveMonths,
  monthKeyOf,
  quarterStart,
  toNumber,
} from "./frappeMappers";
import type {
  DayMark,
  DepartmentHeadcount,
  Employee,
  EmployeeApiResponse,
  EmployeeStatus,
  EmploymentSplitPoint,
  NewHirePoint,
} from "../data/employeeData";
import type { EmploymentType } from "../data/mockData";

interface RawEmployee {
  name: string;
  employee_name: string | null;
  designation: string | null;
  department: string | null;
  employment_type: string | null;
  date_of_joining: string | null;
  status: string | null;
  /** Frappe file path, e.g. `/files/1001.png` or `/private/files/1004.JPG`. */
  image: string | null;
}

/** `{ [field]: value, count: n }` from a grouped count query. */
type RawGroupCount<K extends string> = { [P in K]: string | null } & {
  count: number | string;
};

interface RawAttendance {
  employee: string;
  attendance_date: string;
  status: string | null;
  late_entry: number | null;
}

const ATTENDANCE_WINDOW_DAYS = 14;

function mapStatus(raw: string | null): EmployeeStatus {
  switch ((raw ?? "").toLowerCase()) {
    case "active":
      return "active";
    case "suspended":
    case "on leave":
      return "on-leave";
    default:
      // "Inactive" and "Left" both mean off the active roster.
      return "exited";
  }
}

/**
 * Per-employee sparkline mark. Holiday rows are treated as "present" rather
 * than dropped, because the sparkline renders a fixed 14-cell strip and
 * colouring a plant holiday red would read as an absence.
 */
function markFor(attendanceStatus: string | null, lateEntry: number | null): DayMark {
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

/** Last 14 calendar days, oldest first — the window the sparkline renders. */
function attendanceWindow(): string[] {
  const days: string[] = [];
  for (let i = ATTENDANCE_WINDOW_DAYS - 1; i >= 0; i--) days.push(isoDaysAgo(i));
  return days;
}

/**
 * Plant-wide attendance for the sparkline window. The directory lists every
 * employee, so there is nothing to scope this to — one date-bounded request
 * (~29k rows / 2.4MB, well under a second on the LAN) beats chunking ~2.3k ids
 * into `in` filters to dodge URI length limits.
 */
function fetchAttendanceWindow(windowStart: string): Promise<RawAttendance[]> {
  return getList<RawAttendance>("Attendance", {
    fields: ["employee", "attendance_date", "status", "late_entry"],
    filters: [
      ["attendance_date", ">=", windowStart],
      ["docstatus", "<", 2],
    ],
    limit: 0,
  });
}

export async function fetchEmployeeData(): Promise<EmployeeApiResponse> {
  const windowStart = isoDaysAgo(ATTENDANCE_WINDOW_DAYS - 1);
  const twelveMonthsAgo = isoDaysAgo(365);

  const [
    rawEmployees,
    totalActive,
    newHiresLast7d,
    newHiresThisQuarter,
    presenceRows,
    joinDates,
    attendanceRows,
    deptCounts,
    typeCounts,
  ] = await Promise.all([
      // The Employee read is required (not `optional`) — if it fails there is
      // no dashboard to draw. Fetched unpaged so the directory's department
      // filter agrees with the composition bar, which counts the whole roster.
      getList<RawEmployee>("Employee", {
        fields: [
          "name",
          "employee_name",
          "designation",
          "department",
          "employment_type",
          "date_of_joining",
          "status",
          "image",
        ],
        orderBy: "date_of_joining desc",
        limit: 0,
      }),
      optional("Employee count", getCount("Employee", [["status", "=", "Active"]]), 0),
      optional("New hires (7d)", getCount("Employee", [["date_of_joining", ">=", isoDaysAgo(7)]]), 0),
      optional(
        "New hires (quarter)",
        getCount("Employee", [["date_of_joining", ">=", quarterStart()]]),
        0,
      ),
      // Plant-wide presence for the most recent posted day — attendance here
      // lands a day in arrears, so querying "today" would report 0%.
      optional(
        "Recent presence",
        fetchDailyAttendance(recentAttendanceWindowStart()),
        [] as AttendanceDailyRow[],
      ),
      optional(
        "Hiring history",
        getList<{ date_of_joining: string | null }>("Employee", {
          fields: ["date_of_joining"],
          filters: [["date_of_joining", ">=", twelveMonthsAgo]],
          limit: 0,
        }),
        [] as { date_of_joining: string | null }[],
      ),
      optional("Attendance (14d)", fetchAttendanceWindow(windowStart), [] as RawAttendance[]),
      // Composition is counted server-side over the active roster so the bar
      // stays correct even if the directory read above partially fails.
      optional(
        "Headcount by department",
        getList<RawGroupCount<"department">>("Employee", {
          fields: ["department", "count(name) as count"],
          filters: [["status", "=", "Active"]],
          groupBy: "department",
          limit: 0,
        }),
        [] as RawGroupCount<"department">[],
      ),
      optional(
        "Headcount by employment type",
        getList<RawGroupCount<"employment_type">>("Employee", {
          fields: ["employment_type", "count(name) as count"],
          filters: [["status", "=", "Active"]],
          groupBy: "employment_type",
          limit: 0,
        }),
        [] as RawGroupCount<"employment_type">[],
      ),
    ]);

  // employee id → { date → row }
  const attendanceByEmployee = new Map<string, Map<string, RawAttendance>>();
  for (const row of attendanceRows) {
    let perDay = attendanceByEmployee.get(row.employee);
    if (!perDay) {
      perDay = new Map();
      attendanceByEmployee.set(row.employee, perDay);
    }
    perDay.set(row.attendance_date, row);
  }

  const lastPosted = latestCompleteDay(
    foldByDate(presenceRows),
    totalsByDate(presenceRows),
    totalActive,
  );
  const presentOnLastPostedDay = lastPosted ? lastPosted.present + lastPosted.late : 0;

  const days = attendanceWindow();
  const employees: Employee[] = rawEmployees.map((raw) => {
    const name = raw.employee_name?.trim() || raw.name;
    const perDay = attendanceByEmployee.get(raw.name);
    return {
      id: raw.name,
      name,
      initials: initialsOf(name),
      photoUrl: frappeFileUrl(raw.image),
      role: raw.designation?.trim() || "—",
      department: cleanDepartment(raw.department),
      employmentType: classifyEmploymentType(raw.employment_type),
      joinDate: raw.date_of_joining ?? "",
      status: mapStatus(raw.status),
      // No Attendance row for a day means no record was submitted — rendered
      // as "absent", the same way the sparkline treated missing days before.
      attendance14d: days.map((day) => {
        const row = perDay?.get(day);
        return markFor(row?.status ?? null, row?.late_entry ?? null);
      }) as DayMark[],
    };
  });

  const employmentTypeSplit = buildEmploymentTypeSplit(typeCounts);

  return {
    totalActive: totalActive || employees.filter((e) => e.status === "active").length,
    activeDelta7d: newHiresLast7d,
    dailyWageCount: employmentTypeSplit.find((s) => s.type === "Daily Wage")?.count ?? 0,
    newHiresThisQuarter,
    presentTodayPct:
      totalActive > 0 ? Math.round((presentOnLastPostedDay / totalActive) * 100) : 0,
    headcountByDepartment: buildHeadcountByDepartment(deptCounts),
    employmentTypeSplit,
    newHiresByMonth: buildNewHiresByMonth(joinDates),
    employees,
  };
}

function buildHeadcountByDepartment(
  rawCounts: RawGroupCount<"department">[],
): DepartmentHeadcount[] {
  // Several raw departments can collapse to one label once the " - ATS"
  // company suffix is stripped, so re-total after cleaning.
  const counts = new Map<string, number>();
  for (const row of rawCounts) {
    const department = cleanDepartment(row.department);
    counts.set(department, (counts.get(department) ?? 0) + toNumber(row.count));
  }
  const rows = [...counts.entries()]
    .map(([department, count]) => ({ department, count }))
    .sort((a, b) => b.count - a.count);
  // Components call `Math.max(...rows)` and divide by the total, so an empty
  // array would produce -Infinity / NaN. Always hand back at least one row.
  return rows.length ? rows : [{ department: "No data", count: 0 }];
}

function buildEmploymentTypeSplit(
  rawCounts: RawGroupCount<"employment_type">[],
): EmploymentSplitPoint[] {
  const totals = new Map<EmploymentType, number>([
    ["Permanent", 0],
    ["Daily Wage", 0],
  ]);
  for (const row of rawCounts) {
    const type = classifyEmploymentType(row.employment_type);
    totals.set(type, (totals.get(type) ?? 0) + toNumber(row.count));
  }
  return [...totals.entries()].map(([type, count]) => ({ type, count }));
}

function buildNewHiresByMonth(rows: { date_of_joining: string | null }[]): NewHirePoint[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.date_of_joining) continue;
    const key = monthKeyOf(row.date_of_joining);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  // Skeleton of all 12 months so the strip never renders a ragged/empty axis.
  return lastTwelveMonths().map(({ key, label }) => ({
    month: label,
    count: toNumber(counts.get(key)),
  }));
}
