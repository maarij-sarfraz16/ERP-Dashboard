// Overtime, read from the same doctypes the main dashboard's payroll and
// attendance figures come from.
//
// Two sources, kept apart on purpose:
//
// - **Paid overtime** is the `custom_overtime_hours` / `custom_overtime_amount`
//   fields on submitted Salary Slips (docstatus 1). That is what ATS actually
//   paid out, and it is scoped exactly like every other payroll figure in this
//   app: one selected month (the current one by default), both cycles,
//   `rounded_total` as the "paid" base. The monthly trend, the headline tiles
//   and the department split all come from here.
// - **Logged overtime** is the `custom_overtime` hours field on submitted
//   Attendance rows. It exists before a slip does, so it is the only view of
//   the current, still-open month. The 30-day strip comes from here.
//
// The two reconcile to within ~1% on a complete month (Aug 2026: 208,444 h
// logged vs 206,440 h paid) but are never mixed in one figure.

import { getCount, getList } from "./frappeClient";
import { defaultPayrollMonth } from "./workforceApi";
import {
  classifyPayrollCycle,
  cleanDepartment,
  isoDaysAgo,
  lastTwelveMonths,
  monthKeyOf,
  monthStart,
  toNumber,
} from "./frappeMappers";
import type {
  OvertimeDayPoint,
  OvertimeDeptPoint,
  OvertimeMonthPoint,
  OvertimeReport,
} from "../data/employeeData";

const SUBMITTED = ["docstatus", "=", 1];
const DAILY_WINDOW = 30;

interface SlipMonthRow {
  start_date: string;
  payroll_frequency: string | null;
  hours: number | string;
  amount: number | string;
  paid: number | string;
}

interface SlipDeptRow {
  department: string | null;
  hours: number | string;
  amount: number | string;
  people: number | string;
}

interface AttendanceDayRow {
  attendance_date: string;
  hours: number | string;
  people: number | string;
}

/**
 * `month` (`"2026-09"`) picks which month the headline tiles and department
 * split describe; omitted, it is the current month (see `defaultPayrollMonth`).
 */
export async function fetchOvertimeReport(month?: string | null): Promise<OvertimeReport> {
  const [slipMonths, dailyRows, allowedActive, totalActive] = await Promise.all([
    // Same grouping and window as the payroll trend in `workforceApi.ts`, so
    // month keys and the "complete month" rule line up with the Payroll page.
    getList<SlipMonthRow>("Salary Slip", {
      fields: [
        "start_date",
        "payroll_frequency",
        "sum(custom_overtime_hours) as hours",
        "sum(custom_overtime_amount) as amount",
        "sum(rounded_total) as paid",
      ],
      filters: [["start_date", ">=", monthStart(11)], SUBMITTED],
      groupBy: "start_date, payroll_frequency",
      limit: 0,
    }),

    // Rows without overtime are filtered out server-side so `count(name)` is
    // "people who worked overtime that day", not the whole roster. The window
    // ends yesterday: today's attendance is not posted until the following
    // morning, so including it would always end the line on a false zero.
    getList<AttendanceDayRow>("Attendance", {
      fields: ["attendance_date", "sum(custom_overtime) as hours", "count(name) as people"],
      filters: [
        ["attendance_date", ">=", isoDaysAgo(DAILY_WINDOW)],
        ["attendance_date", "<", isoDaysAgo(0)],
        ["custom_overtime", ">", 0],
        SUBMITTED,
      ],
      groupBy: "attendance_date",
      limit: 0,
    }),

    // Eligibility is a roster fact, so it follows the roster rule: Active
    // employees only, like every headcount on this page.
    getCount("Employee", [
      ["status", "=", "Active"],
      ["custom_allow_overtime", "=", 1],
    ]),
    getCount("Employee", [["status", "=", "Active"]]),
  ]);

  const selected = month || defaultPayrollMonth(slipMonths);
  const monthEnd = nextMonthStart(selected);
  const inMonth: unknown[][] = [
    ["start_date", ">=", `${selected}-01`],
    ["start_date", "<", monthEnd],
    SUBMITTED,
  ];

  // Second round: the default month is only known once the slips are in.
  const [deptRows, employeeRows] = await Promise.all([
    getList<SlipDeptRow>("Salary Slip", {
      fields: [
        "department",
        "sum(custom_overtime_hours) as hours",
        "sum(custom_overtime_amount) as amount",
        "count(distinct employee) as people",
      ],
      filters: [...inMonth, ["custom_overtime_hours", ">", 0]],
      groupBy: "department",
      limit: 0,
    }),
    // Distinct people, not slips: daily-wage staff hold two slips a month.
    getList<{ people: number | string }>("Salary Slip", {
      fields: ["count(distinct employee) as people"],
      filters: [...inMonth, ["custom_overtime_hours", ">", 0]],
      limit: 0,
    }),
  ]);

  const monthly = buildMonthly(slipMonths);
  const current = monthly.find((m) => m.key === selected);
  const hours = current?.hours ?? 0;
  const amount = current?.amount ?? 0;
  const paid = current?.paid ?? 0;

  return {
    month: selected,
    hours,
    amount,
    shareOfPaidPct: paid > 0 ? Math.round((amount / paid) * 1000) / 10 : 0,
    employees: toNumber(employeeRows[0]?.people),
    allowedActive,
    totalActive,
    monthly,
    daily: buildDaily(dailyRows),
    byDepartment: buildByDepartment(deptRows),
  };
}

function nextMonthStart(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function buildMonthly(rows: SlipMonthRow[]): OvertimeMonthPoint[] {
  const byMonth = new Map<string, Pick<OvertimeMonthPoint, "permanentHours" | "dailyWageHours" | "hours" | "amount" | "paid">>();
  for (const row of rows) {
    if (!row.start_date) continue;
    const key = monthKeyOf(row.start_date);
    const m = byMonth.get(key) ?? { permanentHours: 0, dailyWageHours: 0, hours: 0, amount: 0, paid: 0 };
    const h = toNumber(row.hours);
    if (classifyPayrollCycle(row.payroll_frequency) === "Daily Wage") m.dailyWageHours += h;
    else m.permanentHours += h;
    m.hours += h;
    m.amount += toNumber(row.amount);
    m.paid += toNumber(row.paid);
    byMonth.set(key, m);
  }

  const currentMonth = monthKeyOf(monthStart(0));
  const series = lastTwelveMonths().map(({ key, label }) => ({
    key,
    label,
    permanentHours: 0,
    dailyWageHours: 0,
    hours: 0,
    amount: 0,
    paid: 0,
    ...byMonth.get(key),
    complete: key !== currentMonth,
  }));

  // Payroll went live partway through the window; leading empty months are
  // dropped the same way the payroll trend drops them.
  const firstWithData = series.findIndex((p) => p.paid > 0);
  return firstWithData > 0 ? series.slice(firstWithData) : series;
}

function buildDaily(rows: AttendanceDayRow[]): OvertimeDayPoint[] {
  const byDate = new Map(rows.map((r) => [r.attendance_date, r] as const));
  const series: OvertimeDayPoint[] = [];
  for (let i = DAILY_WINDOW; i >= 1; i--) {
    const date = isoDaysAgo(i);
    const row = byDate.get(date);
    series.push({
      date,
      hours: toNumber(row?.hours),
      people: toNumber(row?.people),
    });
  }
  return series;
}

function buildByDepartment(rows: SlipDeptRow[]): OvertimeDeptPoint[] {
  return rows
    .map((row) => ({
      // Keyed on the raw name so two departments never merge once the
      // company suffix is stripped for display.
      id: row.department ?? "",
      department: cleanDepartment(row.department),
      hours: toNumber(row.hours),
      amount: toNumber(row.amount),
      people: toNumber(row.people),
    }))
    .sort((a, b) => b.hours - a.hours);
}
