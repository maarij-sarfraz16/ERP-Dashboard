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
