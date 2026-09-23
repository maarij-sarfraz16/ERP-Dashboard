// Builds `WorkforceApiResponse` out of Frappe HRMS doctypes: Employee,
// Attendance and Salary Slip.
//
// Aggregation is pushed into Frappe with `group_by` + `count()`/`sum()` in the
// `fields` list. On this site that turns 570k Attendance rows into ~1.5k
// aggregate rows and 7k Salary Slips into ~630.

import { getCount, getList, optional } from "./frappeClient";
import {
  emptyAttendancePoint,
  fetchDailyAttendance,
  foldByDate,
  type AttendanceDailyRow,
} from "./attendanceCommon";
import { fetchAttendanceDaySummary } from "./attendanceDay";
import {
  classifyEmploymentType,
  classifyPayrollCycle,
  cleanDepartment,
  isoDaysAgo,
  lastTwelveMonths,
  monthKeyOf,
  monthStart,
  toNumber,
} from "./frappeMappers";
import type {
  AttendancePoint,
  EmploymentTypePoint,
  Kpis,
  PayrollDeptMonthPoint,
  PayrollDeptPoint,
  PayrollMonthPoint,
  PayrollRun,
  WorkforceApiResponse,
} from "../data/mockData";

// Every payroll figure sums Salary Slip `rounded_total` over submitted slips
// (docstatus 1). That is the field ATS relabels "Paid Salary" and the one its
// own "Outgoing Salary" and "Department Wise Salary" charts sum. On monthly
// slips it includes overtime, which `net_pay` does not, so `net_pay` would
// understate permanent payroll by roughly a third.
const PAID = "sum(rounded_total)";
const SUBMITTED = ["docstatus", "=", 1];

interface SalarySlipPeriodRow {
  start_date: string;
  end_date: string | null;
  payroll_frequency: string | null;
  total: number | string;
  paid: number | string;
}

/** Payroll cost keyed by period start + department + pay cycle, for one year. */
interface SalarySlipCostRow {
  start_date: string;
  department: string | null;
  payroll_frequency: string | null;
  paid: number | string;
  gross: number | string;
  deductions: number | string;
  slips: number | string;
}

interface SalarySlipEmployeeRow {
  employee: string;
  rounded_total: number | string;
  start_date: string;
}

const DAILY_WINDOW = 30;
// Enough rows that each cycle filter on the payroll page still shows several
// runs: the semi-monthly cycle produces two per month, the monthly one one.
const RECENT_RUNS = 24;

export async function fetchWorkforceData(): Promise<WorkforceApiResponse> {
  const yearAgo = isoDaysAgo(365);

  const [
    totalEmployees,
    yesterday,
    newHires7d,
    dailyAttendance,
    payrollPeriods,
    payrollCosts,
    cycleSlips,
    employeeTypes,
  ] = await Promise.all([
    // Required: if the roster cannot be read (bad key, no permission) there is
    // no meaningful dashboard, so this failure propagates to the error screen
    // rather than rendering a page full of zeros. Same filter as the ATS
    // "Total Employees" card.
    getCount("Employee", [["status", "=", "Active"]]),

    // Required too: the headline present/absent/late figures come from the
    // ATS Number Cards themselves (see `attendanceDay.ts`). A locally computed
    // stand-in could disagree with the main dashboard, so there is none.
    fetchAttendanceDaySummary(),

    optional("New hires (7d)", getCount("Employee", [["date_of_joining", ">=", isoDaysAgo(7)]]), 0),

    // One year of per-day/per-status counts. The daily, weekly and monthly
    // series plus the presence KPIs are all derived from this single query.
    optional("Attendance history", fetchDailyAttendance(yearAgo), [] as AttendanceDailyRow[]),

    // This site runs two overlapping payroll cycles — semi-monthly (1–15,
    // 16–31) for daily-wage staff and monthly (1–31) for permanent staff — so
    // grouping by the period bounds lists them as the separate runs they are.
    optional(
      "Payroll runs",
      getList<SalarySlipPeriodRow>("Salary Slip", {
        fields: [
          "start_date",
          "end_date",
          "payroll_frequency",
          `${PAID} as total`,
          "count(name) as paid",
        ],
        filters: [SUBMITTED],
        groupBy: "start_date, end_date, payroll_frequency",
        orderBy: "start_date desc",
        limit: RECENT_RUNS,
      }),
      [] as SalarySlipPeriodRow[],
    ),

    // Feeds the 12-month trend, the month-wise and the department breakdowns.
    optional(
      "Payroll costs",
      getList<SalarySlipCostRow>("Salary Slip", {
        fields: [
          "start_date",
          "department",
          "payroll_frequency",
          `${PAID} as paid`,
          "sum(gross_pay) as gross",
          "sum(total_deduction) as deductions",
          "count(name) as slips",
        ],
        filters: [
          ["start_date", ">=", monthStart(11)],
          SUBMITTED,
        ],
        groupBy: "start_date, department, payroll_frequency",
        limit: 0,
      }),
      [] as SalarySlipCostRow[],
    ),

    // Three months of per-employee slips, narrowed client-side to whichever
    // month turns out to be the last complete one (see `latestCompleteMonth`).
    optional(
      "Recent cycle slips",
      getList<SalarySlipEmployeeRow>("Salary Slip", {
        fields: ["employee", "rounded_total", "start_date"],
        filters: [["start_date", ">=", monthStart(2)], SUBMITTED],
        limit: 0,
      }),
      [] as SalarySlipEmployeeRow[],
    ),

    // Employment type lives on Employee, not on Salary Slip, so the payroll
    // split needs this lookup table.
    optional(
      "Employment types",
      getList<{ name: string; employment_type: string | null }>("Employee", {
        fields: ["name", "employment_type"],
        limit: 0,
      }),
      [] as { name: string; employment_type: string | null }[],
    ),
  ]);

  const byDate = foldByDate(dailyAttendance);

  // The current calendar month is mid-cycle, so payroll figures are scoped to
  // the last complete month instead.
  const payrollMonth = latestCompleteMonth(payrollCosts);
  const monthSlips = cycleSlips.filter((s) => monthKeyOf(s.start_date) === payrollMonth);
  // A daily-wage employee gets two slips a month (1–15 and 16–31), so slip
  // count is not headcount.
  const paidEmployees = new Set(monthSlips.map((s) => s.employee));

  const kpis: Kpis = {
    totalEmployees,
    attendanceDate: yesterday.date,
    presentToday: yesterday.present,
    absentToday: yesterday.absent,
    lateToday: yesterday.late,
    attendanceRecordsPosted: yesterday.recordsPosted,
    onPayrollThisCycle: paidEmployees.size,
    presentPct:
      totalEmployees > 0 ? Math.round((yesterday.present / totalEmployees) * 1000) / 10 : 0,
    employeesDelta7d: newHires7d,
  };

  return {
    kpis,
    attendanceDaily: buildDailySeries(byDate),
    attendanceWeekly: buildWeeklySeries(byDate),
    attendanceMonthly: buildMonthlySeries(byDate),
    payrollByDepartment: buildPayrollByDepartment(payrollCosts, payrollMonth),
    payrollMonthly: buildPayrollMonthly(payrollCosts),
    payrollDeptMonthly: buildPayrollDeptMonthly(payrollCosts),
    employmentTypeBreakdown: buildEmploymentTypeBreakdown(monthSlips, employeeTypes),
    // The log page opens on the same day the headline tiles describe.
    latestPostedDate: yesterday.date,
    recentPayrollRuns: buildRecentPayrollRuns(payrollPeriods),
  };
}

function buildDailySeries(byDate: Map<string, AttendancePoint>): AttendancePoint[] {
  const series: AttendancePoint[] = [];
  for (let i = DAILY_WINDOW - 1; i >= 0; i--) {
    const date = isoDaysAgo(i);
    series.push(byDate.get(date) ?? emptyAttendancePoint(date));
  }
  return series;
}

function buildWeeklySeries(byDate: Map<string, AttendancePoint>): AttendancePoint[] {
  const series: AttendancePoint[] = [];
  // 12 trailing 7-day buckets, oldest first — "Wk 1" is the oldest.
  for (let week = 11; week >= 0; week--) {
    const point = emptyAttendancePoint(`Wk ${12 - week}`);
    for (let day = 0; day < 7; day++) {
      const found = byDate.get(isoDaysAgo(week * 7 + day));
      if (found) addInto(point, found);
    }
    series.push(point);
  }
  return series;
}

function buildMonthlySeries(byDate: Map<string, AttendancePoint>): AttendancePoint[] {
  const totals = new Map<string, AttendancePoint>();
  for (const [date, point] of byDate) {
    const key = monthKeyOf(date);
    const running = totals.get(key) ?? emptyAttendancePoint(key);
    addInto(running, point);
    totals.set(key, running);
  }
  return lastTwelveMonths().map(({ key, label }) => ({
    ...(totals.get(key) ?? emptyAttendancePoint(key)),
    date: label,
  }));
}

function addInto(target: AttendancePoint, source: AttendancePoint): void {
  target.present += source.present;
  target.late += source.late;
  target.halfDay += source.halfDay;
  target.absent += source.absent;
  target.holiday += source.holiday;
}

/**
 * The most recent month whose payroll is finished.
 *
 * This site runs two overlapping cycles: a semi-monthly one for ~320 daily-wage
 * staff and a monthly one for ~1,850 permanent staff. The monthly run is only
 * created at month end, so during the current month the only slips that exist
 * are the daily-wage ones — reporting on it would show roughly a twelfth of the
 * real cost and zero permanent employees. Excluding the in-progress month
 * avoids that, at the price of the figures trailing by up to a month.
 */
function latestCompleteMonth(rows: SalarySlipCostRow[]): string {
  const currentMonth = monthKeyOf(monthStart(0));
  let latest = "";
  for (const row of rows) {
    const key = monthKeyOf(row.start_date);
    if (key !== currentMonth && key > latest) latest = key;
  }
  // Nothing but the current month on record — better to show partial data than
  // an empty dashboard.
  return latest || currentMonth;
}

/**
 * Department paid salary for one month. Scoped to a single month on purpose: a wider
 * window would mix the two cycles unevenly and make departments look
 * arbitrarily more expensive than each other.
 */
function buildPayrollByDepartment(
  rows: SalarySlipCostRow[],
  month: string,
): PayrollDeptPoint[] {
  const byDept = new Map<string, number>();
  for (const row of rows) {
    if (monthKeyOf(row.start_date) !== month) continue;
    const department = cleanDepartment(row.department);
    byDept.set(department, (byDept.get(department) ?? 0) + toNumber(row.paid));
  }

  const points = [...byDept.entries()]
    .map(([department, cost]) => ({ department, cost }))
    .sort((a, b) => b.cost - a.cost);
  // Chart components call `Math.max(...data)`, which is -Infinity when empty.
  return points.length ? points : [{ department: "No payroll data", cost: 0 }];
}

function buildPayrollMonthly(rows: SalarySlipCostRow[]): PayrollMonthPoint[] {
  const byMonth = new Map<string, Omit<PayrollMonthPoint, "key" | "period" | "complete">>();
  for (const row of rows) {
    if (!row.start_date) continue;
    const key = monthKeyOf(row.start_date);
    const m = byMonth.get(key) ?? {
      permanent: 0,
      dailyWage: 0,
      paid: 0,
      gross: 0,
      deductions: 0,
      slips: 0,
    };
    const paid = toNumber(row.paid);
    if (classifyPayrollCycle(row.payroll_frequency) === "Daily Wage") m.dailyWage += paid;
    else m.permanent += paid;
    m.paid += paid;
    m.gross += toNumber(row.gross);
    m.deductions += toNumber(row.deductions);
    m.slips += toNumber(row.slips);
    byMonth.set(key, m);
  }

  const currentMonth = monthKeyOf(monthStart(0));
  const series = lastTwelveMonths().map(({ key, label }) => ({
    key,
    period: label,
    permanent: 0,
    dailyWage: 0,
    paid: 0,
    gross: 0,
    deductions: 0,
    slips: 0,
    ...byMonth.get(key),
    complete: key !== currentMonth,
  }));

  // Drop leading months with no payroll at all — payroll only went live
  // partway through this window, and `PayrollPage` computes month-on-month
  // change, which a leading zero would turn into "Infinity%".
  const firstWithData = series.findIndex((p) => p.paid > 0);
  return firstWithData > 0 ? series.slice(firstWithData) : series;
}

function buildPayrollDeptMonthly(rows: SalarySlipCostRow[]): PayrollDeptMonthPoint[] {
  const byKey = new Map<string, PayrollDeptMonthPoint>();
  for (const row of rows) {
    if (!row.start_date) continue;
    const month = monthKeyOf(row.start_date);
    const department = cleanDepartment(row.department);
    const key = `${month}|${department}`;
    const point = byKey.get(key) ?? { month, department, permanent: 0, dailyWage: 0 };
    const paid = toNumber(row.paid);
    if (classifyPayrollCycle(row.payroll_frequency) === "Daily Wage") point.dailyWage += paid;
    else point.permanent += paid;
    byKey.set(key, point);
  }
  return [...byKey.values()];
}

function buildEmploymentTypeBreakdown(
  slips: SalarySlipEmployeeRow[],
  employees: { name: string; employment_type: string | null }[],
): EmploymentTypePoint[] {
  const typeOf = new Map(
    employees.map((e) => [e.name, classifyEmploymentType(e.employment_type)] as const),
  );

  const totals: Record<"Permanent" | "Daily Wage", { amount: number; headcount: number }> = {
    Permanent: { amount: 0, headcount: 0 },
    "Daily Wage": { amount: 0, headcount: 0 },
  };
  // Headcount must be distinct people: daily-wage staff hold two slips per
  // month, so counting slips would nearly double them.
  const seen: Record<"Permanent" | "Daily Wage", Set<string>> = {
    Permanent: new Set(),
    "Daily Wage": new Set(),
  };

  for (const slip of slips) {
    const type = typeOf.get(slip.employee) ?? "Permanent";
    totals[type].amount += toNumber(slip.rounded_total);
    seen[type].add(slip.employee);
  }
  totals.Permanent.headcount = seen.Permanent.size;
  totals["Daily Wage"].headcount = seen["Daily Wage"].size;

  return [
    { type: "Permanent", ...totals.Permanent },
    { type: "Daily Wage", ...totals["Daily Wage"] },
  ];
}

function buildRecentPayrollRuns(rows: SalarySlipPeriodRow[]): PayrollRun[] {
  return rows.map((row) => ({
    id: `${row.start_date}:${row.end_date ?? ""}:${row.payroll_frequency ?? ""}`,
    period: formatPeriod(row.start_date, row.end_date),
    runDate: row.end_date ?? row.start_date,
    employeesPaid: toNumber(row.paid),
    totalAmount: toNumber(row.total),
    // Only submitted slips are read, so every run listed is complete.
    status: "completed",
    cycle: classifyPayrollCycle(row.payroll_frequency),
  }));
}

function formatPeriod(start: string, end: string | null): string {
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (!end) return `${fmt(start)}, ${start.slice(0, 4)}`;
  return `${fmt(start)} – ${fmt(end)}, ${end.slice(0, 4)}`;
}
