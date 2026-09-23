// Shapes of the data the Employees page renders, all built from Frappe by
// `src/api/employeeApi.ts` — there is no mock data behind these types.

import type { EmploymentType } from "./mockData";

export type EmployeeStatus = "active" | "on-leave" | "exited";
/** One day on the directory sparkline. Fetched per window by `useAttendanceMarks`. */
export type DayMark = "present" | "late" | "absent";

export interface Employee {
  id: string;
  name: string;
  initials: string;
  /** Absolute URL of the employee's photo, or null when none is on file. */
  photoUrl: string | null;
  role: string;
  department: string;
  employmentType: EmploymentType;
  joinDate: string;
  status: EmployeeStatus;
}

/**
 * One Employee record with the raw Frappe values the Workforce snapshot
 * filters and counts on (status, pay mode, bank, exit reason, …). Built from
 * the same roster read as `Employee`, so the two never disagree.
 */
export interface HeadcountEmployee {
  id: string;
  name: string;
  photoUrl: string | null;
  /** Raw Frappe values, trimmed; `""` where the field is blank. */
  status: string;
  department: string;
  designation: string;
  gender: string;
  maritalStatus: string;
  /** Folded to Frappe's Select spelling (Bank / Cash / Cheque); see normalizeSalaryMode. */
  salaryMode: string;
  bankName: string;
  reasonForLeaving: string;
  dateOfJoining: string;
  relievingDate: string;
  dateOfBirth: string;
  branch: string;
}

export interface DepartmentHeadcount {
  department: string;
  count: number;
}

export interface DesignationHeadcount {
  designation: string;
  count: number;
}

export interface EmploymentSplitPoint {
  type: EmploymentType;
  count: number;
}

export interface NewHirePoint {
  month: string;
  count: number;
}

/**
 * One row of the ATS "Gratuity of Employee" script report, in PKR. Values are
 * taken verbatim from the report — nothing here is estimated client-side.
 */
export interface GratuityRecord {
  employeeId: string;
  employeeName: string;
  /** Raw Frappe department name, e.g. `ACCOUNTS - ATS`. */
  department: string;
  total: number;
  consumed: number;
  remaining: number;
  /** As the report computes it (already rounded server-side). */
  consumedPct: number;
}

/** The report's own Grand Total row — the figures ATS shows on its dashboard. */
export interface GratuityTotals {
  employees: number;
  total: number;
  consumed: number;
  remaining: number;
  consumedPct: number;
}

export interface GratuityReport {
  totals: GratuityTotals;
  records: GratuityRecord[];
}

/**
 * One payroll month of overtime, summed from submitted Salary Slips — the
 * hours and rupees that were actually paid out, not merely logged.
 */
export interface OvertimeMonthPoint {
  /** `"2026-08"`. */
  key: string;
  /** `"Aug"`. */
  label: string;
  /** Overtime hours on monthly-cycle (permanent) slips. */
  permanentHours: number;
  /** Overtime hours on semi-monthly (daily-wage) slips. */
  dailyWageHours: number;
  hours: number;
  amount: number;
  /** Everything paid that month (`rounded_total`), for the overtime share. */
  paid: number;
  /** False for the month still in progress. */
  complete: boolean;
}

/** Overtime hours logged on submitted Attendance for one calendar day. */
export interface OvertimeDayPoint {
  date: string;
  hours: number;
  /** Attendance rows that carry any overtime that day. */
  people: number;
}

export interface OvertimeDeptPoint {
  /** Raw Frappe department name, e.g. `TRANSPORT - ATS`. */
  id: string;
  department: string;
  hours: number;
  amount: number;
  people: number;
}

export interface OvertimeReport {
  /** The payroll month the headline figures and department split describe. */
  month: string;
  hours: number;
  amount: number;
  /** Share of that month's paid salary that was overtime, 0–100. */
  shareOfPaidPct: number;
  /** Distinct employees whose slips that month carried overtime. */
  employees: number;
  /** Active employees with "Allow Overtime" ticked on their record. */
  allowedActive: number;
  /** Active headcount, so `allowedActive` can be shown as a share. */
  totalActive: number;
  monthly: OvertimeMonthPoint[];
  daily: OvertimeDayPoint[];
  byDepartment: OvertimeDeptPoint[];
}

export interface EmployeeApiResponse {
  totalActive: number;
  /** Employees whose date of joining is in the last 7 days. */
  joinedLast7d: number;
  dailyWageCount: number;
  newHiresThisQuarter: number;
  presentTodayPct: number;
  /** The attendance day `presentTodayPct` describes. */
  presenceDate: string | null;
  headcountByDepartment: DepartmentHeadcount[];
  headcountByDesignation: DesignationHeadcount[];
  employmentTypeSplit: EmploymentSplitPoint[];
  newHiresByMonth: NewHirePoint[];
  employees: Employee[];
  /** Null when the report could not be read — never substituted with estimates. */
  gratuity: GratuityReport | null;
  /** The whole roster (every status), for the Workforce snapshot's filters. */
  roster: HeadcountEmployee[];
  /**
   * The attendance day summarised in the snapshot: yesterday in the Frappe
   * site's time zone, the same day `presenceDate` and the Overview tiles describe.
   */
  attendanceDate: string | null;
  /**
   * employee id → the `status` of each of their Attendance records on
   * `attendanceDate`. Usually one, but someone who worked two shifts has two,
   * and ATS counts both.
   */
  attendanceByEmployee: Map<string, string[]>;
}

/**
 * Active headcount per designation, most common first. The designation is
 * only available on the roster rows, so it is tallied client-side.
 */
export function buildHeadcountByDesignation(employees: Employee[]): DesignationHeadcount[] {
  const counts = new Map<string, number>();
  for (const e of employees) {
    if (e.status !== "active") continue;
    counts.set(e.role, (counts.get(e.role) ?? 0) + 1);
  }
  const rows = [...counts.entries()]
    .map(([designation, count]) => ({ designation, count }))
    .sort((a, b) => b.count - a.count || a.designation.localeCompare(b.designation));
  return rows.length ? rows : [{ designation: "No data", count: 0 }];
}
