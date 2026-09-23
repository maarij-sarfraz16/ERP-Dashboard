// Shapes of the data the workforce pages render. Every value is built from
// Frappe by `src/api/` — there is no mock data behind these types.

/** One Attendance row: its ATS `status`, with Present split on `late_entry`. */
export type AttendanceStatus = "on-time" | "late" | "half-day" | "absent" | "holiday";
export type PayrollRunStatus = "completed" | "processing" | "pending";
export type EmploymentType = "Permanent" | "Daily Wage";

export interface Kpis {
  totalEmployees: number;
  /**
   * The attendance day the three counts below describe: the calendar
   * "yesterday" in the Frappe site's time zone, as the ATS Overview
   * workspace defines it. Null only if the server could not say.
   */
  attendanceDate: string | null;
  /** ATS card "Total Present (Yesterday)", evaluated by Frappe. */
  presentToday: number;
  /** ATS card "Absent Yesterday", evaluated by Frappe. */
  absentToday: number;
  /** ATS card "Late Entry (Yesterday)", evaluated by Frappe. */
  lateToday: number;
  /**
   * Submitted Attendance rows on `attendanceDate`. Posting runs in batches
   * through the following morning, so while this is well short of
   * `totalEmployees` the three counts above are still filling in.
   */
  attendanceRecordsPosted: number;
  /** ATS card "Checkins Today": Employee Checkin rows stamped today, evaluated by Frappe. */
  checkinsToday: number;
  /** ATS card "Employee Type Wise-1": employment type PERMANENT, any status. */
  permanentEmployees: number;
  /** ATS card "Employee Type WIse": employment type DAILY WAGES, any status. */
  dailyWageEmployees: number;
  presentPct: number;
  /** Employees whose date of joining is in the last 7 days. */
  employeesDelta7d: number;
}

/**
 * Attendance records in one bucket, one field per ATS status. The fields are
 * disjoint, so their sum is exactly the number of Attendance records — the
 * figure ATS's own "Daily Attendance Trend" chart plots.
 */
export interface AttendancePoint {
  date: string;
  /** `Present` (late or not) plus `Work From Home` — the ATS "Total Present" card. */
  present: number;
  /**
   * Rows with `late_entry = 1` on any status — the ATS "Late Entry" card.
   * Overlaps the status bands, so it is NOT part of the stacked total.
   */
  late: number;
  halfDay: number;
  /** `Absent` and `On Leave`. */
  absent: number;
  holiday: number;
}

export interface PayrollDeptPoint {
  department: string;
  cost: number;
}

/** One calendar month of payroll, split by pay cycle. */
export interface PayrollMonthPoint {
  /** `"2026-08"` */
  key: string;
  /** `"Aug"` */
  period: string;
  /** Monthly cycle — permanent staff. */
  permanent: number;
  /** Semi-monthly cycle — daily-wage staff. */
  dailyWage: number;
  /** Sum of Salary Slip `rounded_total`, which ATS labels "Paid Salary". */
  paid: number;
  gross: number;
  deductions: number;
  slips: number;
  /** Distinct employees with a submitted slip that month (not slip count). */
  employeesPaid: number;
  /** Paid amount and headcount split by employment type. */
  byType: EmploymentTypePoint[];
  /** False for the current calendar month, whose runs are not all posted. */
  complete: boolean;
}

/** Paid salary of one department in one month, split by pay cycle. */
export interface PayrollDeptMonthPoint {
  month: string;
  department: string;
  permanent: number;
  dailyWage: number;
}

export interface EmploymentTypePoint {
  type: EmploymentType;
  amount: number;
  headcount: number;
}

export interface CheckIn {
  id: string;
  employeeName: string;
  department: string;
  shift: string;
  checkIn: string;
  checkOut: string | null;
  status: AttendanceStatus;
  /**
   * The HRMS `late_entry` flag, kept separately because ATS's "Late Entry"
   * card counts it on any status — an Absent row can be flagged late too.
   */
  lateEntry: boolean;
  minutesLate: number;
}

export interface PayrollRun {
  id: string;
  period: string;
  runDate: string;
  employeesPaid: number;
  totalAmount: number;
  status: PayrollRunStatus;
  /** Which payroll cycle the run belongs to. */
  cycle: EmploymentType;
}

export interface WorkforceApiResponse {
  kpis: Kpis;
  attendanceDaily: AttendancePoint[];
  attendanceWeekly: AttendancePoint[];
  attendanceMonthly: AttendancePoint[];
  /** Twelve months, oldest first; the last entry is the current month. */
  payrollMonthly: PayrollMonthPoint[];
  payrollDeptMonthly: PayrollDeptMonthPoint[];
  /**
   * The month pages open on: the current calendar month when it has any
   * submitted slips, otherwise the latest month that does.
   */
  defaultPayrollMonth: string;
  /** The same day as `kpis.attendanceDate` — where the attendance log opens. */
  latestPostedDate: string | null;
  recentPayrollRuns: PayrollRun[];
}
