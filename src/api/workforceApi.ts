// Builds `WorkforceApiResponse` (the exact contract `useWorkforceData`
// returned from mock data) out of Frappe HRMS doctypes: Employee, Attendance,
// Salary Slip and Shift Type.
//
// Aggregation is pushed into Frappe with `group_by` + `count()`/`sum()` in the
// `fields` list. On this site that turns 570k Attendance rows into ~1.5k
// aggregate rows and 7k Salary Slips into ~630.

import { getCount, getList, optional } from "./frappeClient";
import {
  attendanceBand,
  fetchDailyAttendance,
  foldByDate,
  latestCompleteDay,
  totalsByDate,
  type AttendanceDailyRow,
} from "./attendanceCommon";
import {
  classifyEmploymentType,
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
  PayrollDeptPoint,
  PayrollRun,
  PayrollTrendPoint,
  WorkforceApiResponse,
} from "../data/mockData";

interface SalarySlipPeriodRow {
  start_date: string;
  end_date: string | null;
  docstatus: number;
  total: number | string;
  paid: number | string;
}

/** Payroll cost keyed by period start + department, for one year. */
interface SalarySlipCostRow {
  start_date: string;
  department: string | null;
  cost: number | string;
}

interface SalarySlipEmployeeRow {
  employee: string;
  net_pay: number | string;
  start_date: string;
}

const DAILY_WINDOW = 30;
const RECENT_RUNS = 5;

export async function fetchWorkforceData(): Promise<WorkforceApiResponse> {
  const yearAgo = isoDaysAgo(365);

  const [
    totalEmployees,
    newHires7d,
    dailyAttendance,
    payrollPeriods,
    payrollCosts,
    cycleSlips,
    employeeTypes,
  ] = await Promise.all([
    // Required: if the roster cannot be read (bad key, no permission) there is
    // no meaningful dashboard, so this failure propagates to the error screen
    // rather than rendering a page full of zeros.
    getCount("Employee", [["status", "=", "Active"]]),

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
          "docstatus",
          "sum(net_pay) as total",
          "count(name) as paid",
        ],
        filters: [["docstatus", "<", 2]],
        groupBy: "start_date, end_date, docstatus",
        orderBy: "start_date desc",
        limit: RECENT_RUNS,
      }),
      [] as SalarySlipPeriodRow[],
    ),

    // Feeds both the 12-month trend and the department breakdown.
    optional(
      "Payroll costs",
      getList<SalarySlipCostRow>("Salary Slip", {
        fields: ["start_date", "department", "sum(net_pay) as cost"],
        filters: [
          ["start_date", ">=", monthStart(11)],
          ["docstatus", "<", 2],
        ],
        groupBy: "start_date, department",
        limit: 0,
      }),
      [] as SalarySlipCostRow[],
    ),

    // Three months of per-employee slips, narrowed client-side to whichever
    // month turns out to be the last complete one (see `latestCompleteMonth`).
    optional(
      "Recent cycle slips",
      getList<SalarySlipEmployeeRow>("Salary Slip", {
        fields: ["employee", "net_pay", "start_date"],
        filters: [
          ["start_date", ">=", monthStart(2)],
          ["docstatus", "<", 2],
        ],
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
  const lastPosted = latestCompleteDay(byDate, totalsByDate(dailyAttendance), totalEmployees);
  // "Late" employees did turn up, so they count towards presence.
  const presentToday = lastPosted ? lastPosted.present + lastPosted.late : 0;

  // The current calendar month is mid-cycle, so payroll figures are scoped to
  // the last complete month instead.
  const payrollMonth = latestCompleteMonth(payrollCosts);
  const monthSlips = cycleSlips.filter((s) => monthKeyOf(s.start_date) === payrollMonth);
  // A daily-wage employee gets two slips a month (1–15 and 16–31), so slip
  // count is not headcount.
  const paidEmployees = new Set(monthSlips.map((s) => s.employee));

  const kpis: Kpis = {
    totalEmployees,
    presentToday,
    absentToday: lastPosted?.absent ?? 0,
    onPayrollThisCycle: paidEmployees.size || totalEmployees,
    presentPct: totalEmployees > 0 ? Math.round((presentToday / totalEmployees) * 1000) / 10 : 0,
    employeesDelta7d: newHires7d,
  };

  return {
    kpis,
    attendanceDaily: buildDailySeries(byDate),
    attendanceWeekly: buildWeeklySeries(byDate),
    attendanceMonthly: buildMonthlySeries(byDate),
    payrollByDepartment: buildPayrollByDepartment(payrollCosts, payrollMonth),
    payrollTrend: buildPayrollTrend(payrollCosts),
    employmentTypeBreakdown: buildEmploymentTypeBreakdown(monthSlips, employeeTypes),
    // The log page opens on this day; "today" is usually not posted yet.
    latestPostedDate: lastPosted?.date ?? null,
    recentPayrollRuns: buildRecentPayrollRuns(payrollPeriods),
  };
}

function buildDailySeries(byDate: Map<string, AttendancePoint>): AttendancePoint[] {
  const series: AttendancePoint[] = [];
  for (let i = DAILY_WINDOW - 1; i >= 0; i--) {
    const date = isoDaysAgo(i);
    series.push(byDate.get(date) ?? { date, present: 0, absent: 0, late: 0 });
  }
  return series;
}

function buildWeeklySeries(byDate: Map<string, AttendancePoint>): AttendancePoint[] {
  const series: AttendancePoint[] = [];
  // 12 trailing 7-day buckets, oldest first — "Wk 1" is the oldest.
  for (let week = 11; week >= 0; week--) {
    const point: AttendancePoint = { date: `Wk ${12 - week}`, present: 0, absent: 0, late: 0 };
    for (let day = 0; day < 7; day++) {
      const found = byDate.get(isoDaysAgo(week * 7 + day));
      if (!found) continue;
      point.present += found.present;
      point.absent += found.absent;
      point.late += found.late;
    }
    series.push(point);
  }
  return series;
}

function buildMonthlySeries(byDate: Map<string, AttendancePoint>): AttendancePoint[] {
  const totals = new Map<string, AttendancePoint>();
  for (const [date, point] of byDate) {
    const key = monthKeyOf(date);
    const running = totals.get(key) ?? { date: key, present: 0, absent: 0, late: 0 };
    running.present += point.present;
    running.absent += point.absent;
    running.late += point.late;
    totals.set(key, running);
  }
  return lastTwelveMonths().map(({ key, label }) => {
    const found = totals.get(key);
    return {
      date: label,
      present: found?.present ?? 0,
      absent: found?.absent ?? 0,
      late: found?.late ?? 0,
    };
  });
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
 * Department cost for one month. Scoped to a single month on purpose: a wider
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
    byDept.set(department, (byDept.get(department) ?? 0) + toNumber(row.cost));
  }

  const points = [...byDept.entries()]
    .map(([department, cost]) => ({ department, cost }))
    .sort((a, b) => b.cost - a.cost);
  // Chart components call `Math.max(...data)`, which is -Infinity when empty.
  return points.length ? points : [{ department: "No payroll data", cost: 0 }];
}

function buildPayrollTrend(rows: SalarySlipCostRow[]): PayrollTrendPoint[] {
  const byMonth = new Map<string, number>();
  for (const row of rows) {
    if (!row.start_date) continue;
    const key = monthKeyOf(row.start_date);
    byMonth.set(key, (byMonth.get(key) ?? 0) + toNumber(row.cost));
  }
  const series = lastTwelveMonths().map(({ key, label }) => ({
    period: label,
    amount: toNumber(byMonth.get(key)),
  }));

  // Drop leading months with no payroll at all. Payroll only went live partway
  // through this window, and `PayrollPage` derives its growth figure from
  // `series[0].amount` — leaving a zero there yields a division by zero and an
  // "Infinity%" headline.
  const firstWithData = series.findIndex((p) => p.amount > 0);
  return firstWithData > 0 ? series.slice(firstWithData) : series;
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
    totals[type].amount += toNumber(slip.net_pay);
    seen[type].add(slip.employee);
  }
  totals.Permanent.headcount = seen.Permanent.size;
  totals["Daily Wage"].headcount = seen["Daily Wage"].size;

  // Fall back to roster headcount when nobody has been paid in this cycle yet.
  if (slips.length === 0) {
    for (const [, type] of typeOf) totals[type].headcount += 1;
  }

  return [
    { type: "Permanent", ...totals.Permanent },
    { type: "Daily Wage", ...totals["Daily Wage"] },
  ];
}

function buildRecentPayrollRuns(rows: SalarySlipPeriodRow[]): PayrollRun[] {
  return rows.map((row) => ({
    id: `${row.start_date}:${row.end_date ?? ""}:${row.docstatus}`,
    period: formatPeriod(row.start_date, row.end_date),
    runDate: row.end_date ?? row.start_date,
    employeesPaid: toNumber(row.paid),
    totalAmount: toNumber(row.total),
    // docstatus 0 = draft slips still being reviewed, 1 = submitted/paid.
    status: row.docstatus === 1 ? "completed" : "processing",
  }));
}

function formatPeriod(start: string, end: string | null): string {
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (!end) return `${fmt(start)}, ${start.slice(0, 4)}`;
  return `${fmt(start)} – ${fmt(end)}, ${end.slice(0, 4)}`;
}
