// Builds `EmployeeApiResponse` out of Frappe HRMS doctypes: Employee +
// Attendance, plus the ATS gratuity report.
// Per-employee sparkline marks live in `attendanceMarks.ts` — they depend on
// a user-picked window, so they are fetched separately from the roster.
//
// The Workforce snapshot (status, pay mode, bank, exit reason, yesterday's
// attendance) is fed from the same single roster read: its filters must apply
// to every panel, so the rows are joined and counted in the browser. ~2.3k
// employees and one day of attendance is small enough for that.

import { frappeFileUrl, getCount, getList, optional } from "./frappeClient";
import { fetchAttendanceDaySummary } from "./attendanceDay";
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
import { fetchGratuityReport } from "./gratuityApi";
import { buildHeadcountByDesignation } from "../data/employeeData";
import type {
  DepartmentHeadcount,
  Employee,
  EmployeeApiResponse,
  EmployeeStatus,
  EmploymentSplitPoint,
  GratuityReport,
  HeadcountEmployee,
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
  gender: string | null;
  marital_status: string | null;
  salary_mode: string | null;
  bank_name: string | null;
  reason_for_leaving: string | null;
  relieving_date: string | null;
  date_of_birth: string | null;
  blood_group: string | null;
  branch: string | null;
}

const clean = (v: string | null | undefined) => (v ?? "").trim();

/**
 * `salary_mode` is a Select (Bank / Cash / Cheque) in Frappe, but imported
 * records carry it in mixed case — "BANK" and "Bank" both exist on the live
 * site. They are one mode; fold to the Select's own spelling so the pay-mode
 * card doesn't split bank-paid staff in two and the bank card counts all of
 * them. Anything else is left as HR entered it.
 */
const SALARY_MODES = ["Bank", "Cash", "Cheque"];
function normalizeSalaryMode(raw: string | null | undefined): string {
  const v = clean(raw);
  return SALARY_MODES.find((m) => m.toLowerCase() === v.toLowerCase()) ?? v;
}

/** `{ [field]: value, count: n }` from a grouped count query. */
type RawGroupCount<K extends string> = { [P in K]: string | null } & {
  count: number | string;
};

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

export async function fetchEmployeeData(): Promise<EmployeeApiResponse> {
  const twelveMonthsAgo = isoDaysAgo(365);

  const [
    rawEmployees,
    totalActive,
    newHiresLast7d,
    newHiresThisQuarter,
    yesterday,
    joinDates,
    deptCounts,
    typeCounts,
    gratuity,
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
          "gender",
          "marital_status",
          "salary_mode",
          "bank_name",
          "reason_for_leaving",
          "relieving_date",
          "date_of_birth",
          "blood_group",
          "branch",
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
      // Plant-wide presence for yesterday, from the ATS Number Cards — the
      // same figure the Overview page and the main dashboard show. Required,
      // so a card that cannot be evaluated surfaces as an error, not as 0%.
      fetchAttendanceDaySummary(),
      optional(
        "Hiring history",
        getList<{ date_of_joining: string | null }>("Employee", {
          fields: ["date_of_joining"],
          filters: [["date_of_joining", ">=", twelveMonthsAgo]],
          limit: 0,
        }),
        [] as { date_of_joining: string | null }[],
      ),
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
      // Read straight from the ATS report. On failure the panel says so rather
      // than showing estimated figures.
      optional("Gratuity report", fetchGratuityReport(), null as GratuityReport | null),
    ]);

  // Per-employee statuses for the day the tiles describe. Depends on the
  // resolved date, so it cannot join the batch above.
  const attendanceRows = yesterday.date
    ? await getList<{ employee: string; status: string | null }>("Attendance", {
        fields: ["employee", "status"],
        filters: [
          ["attendance_date", "=", yesterday.date],
          ["docstatus", "=", 1],
        ],
        limit: 0,
      })
    : [];

  const attendanceByEmployee = new Map<string, string[]>();
  for (const row of attendanceRows) {
    const list = attendanceByEmployee.get(row.employee) ?? [];
    list.push(clean(row.status));
    attendanceByEmployee.set(row.employee, list);
  }

  const roster: HeadcountEmployee[] = rawEmployees.map((raw) => ({
    id: raw.name,
    name: clean(raw.employee_name) || raw.name,
    photoUrl: frappeFileUrl(raw.image),
    status: clean(raw.status),
    department: clean(raw.department),
    designation: clean(raw.designation),
    gender: clean(raw.gender),
    maritalStatus: clean(raw.marital_status),
    salaryMode: normalizeSalaryMode(raw.salary_mode),
    bankName: clean(raw.bank_name),
    reasonForLeaving: clean(raw.reason_for_leaving),
    dateOfJoining: clean(raw.date_of_joining),
    relievingDate: clean(raw.relieving_date),
    dateOfBirth: clean(raw.date_of_birth),
    bloodGroup: clean(raw.blood_group),
    branch: clean(raw.branch),
  }));

  const employees: Employee[] = rawEmployees.map((raw) => {
    const name = raw.employee_name?.trim() || raw.name;
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
    };
  });

  const employmentTypeSplit = buildEmploymentTypeSplit(typeCounts);

  return {
    totalActive: totalActive || employees.filter((e) => e.status === "active").length,
    joinedLast7d: newHiresLast7d,
    dailyWageCount: employmentTypeSplit.find((s) => s.type === "Daily Wage")?.count ?? 0,
    newHiresThisQuarter,
    presentTodayPct: totalActive > 0 ? Math.round((yesterday.present / totalActive) * 100) : 0,
    presenceDate: yesterday.date,
    headcountByDepartment: buildHeadcountByDepartment(deptCounts),
    headcountByDesignation: buildHeadcountByDesignation(employees),
    employmentTypeSplit,
    newHiresByMonth: buildNewHiresByMonth(joinDates),
    employees,
    gratuity,
    roster,
    attendanceDate: yesterday.date,
    attendanceByEmployee,
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
