// Mock data shaped like a real REST API response payload.
// Swap `fetchWorkforceData()` in `src/hooks/useWorkforceData.ts` for a real
// `fetch('/api/workforce')` call later — no component code needs to change.

export type AttendanceStatus = "on-time" | "late" | "absent";
export type PayrollRunStatus = "completed" | "processing" | "pending";
export type EmploymentType = "Permanent" | "Daily Wage";

export interface Kpis {
  totalEmployees: number;
  presentToday: number;
  absentToday: number;
  onPayrollThisCycle: number;
  presentPct: number;
  employeesDelta7d: number;
}

export interface AttendancePoint {
  date: string;
  present: number;
  absent: number;
  late: number;
}

export interface PayrollDeptPoint {
  department: string;
  cost: number;
}

export interface PayrollTrendPoint {
  period: string;
  amount: number;
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
  minutesLate: number;
}

export interface PayrollRun {
  id: string;
  period: string;
  runDate: string;
  employeesPaid: number;
  totalAmount: number;
  status: PayrollRunStatus;
}

export interface WorkforceApiResponse {
  kpis: Kpis;
  attendanceDaily: AttendancePoint[];
  attendanceWeekly: AttendancePoint[];
  attendanceMonthly: AttendancePoint[];
  payrollByDepartment: PayrollDeptPoint[];
  payrollTrend: PayrollTrendPoint[];
  employmentTypeBreakdown: EmploymentTypePoint[];
  /** ISO date of the most recent fully-posted attendance day, if any. */
  latestPostedDate: string | null;
  recentPayrollRuns: PayrollRun[];
}

function isoDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function buildAttendanceDaily(): AttendancePoint[] {
  const points: AttendancePoint[] = [];
  const total = 486;
  for (let i = 29; i >= 0; i--) {
    const isWeekend = new Date(isoDaysAgo(i)).getDay() % 6 === 0;
    const base = isWeekend ? 0.72 : 0.91;
    const wobble = Math.sin(i / 3.1) * 0.03 + (i % 7 === 0 ? -0.05 : 0);
    const presentPct = Math.min(0.97, Math.max(0.6, base + wobble));
    const present = Math.round(total * presentPct);
    const late = Math.round(total * 0.035 * (1 + Math.abs(wobble) * 4));
    const absent = total - present - late > 0 ? total - present - late : 4;
    points.push({ date: isoDaysAgo(i), present, absent, late });
  }
  return points;
}

function buildAttendanceWeekly(): AttendancePoint[] {
  const labels = [
    "Wk 1",
    "Wk 2",
    "Wk 3",
    "Wk 4",
    "Wk 5",
    "Wk 6",
    "Wk 7",
    "Wk 8",
    "Wk 9",
    "Wk 10",
    "Wk 11",
    "Wk 12",
  ];
  const total = 486 * 6;
  return labels.map((label, i) => {
    const presentPct = 0.86 + Math.sin(i / 2.4) * 0.04;
    const present = Math.round(total * presentPct);
    const late = Math.round(total * 0.03);
    const absent = total - present - late;
    return { date: label, present, absent, late };
  });
}

function buildAttendanceMonthly(): AttendancePoint[] {
  const labels = [
    "Oct",
    "Nov",
    "Dec",
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
  ];
  const total = 486 * 26;
  return labels.map((label, i) => {
    const presentPct = 0.84 + Math.sin(i / 3) * 0.05;
    const present = Math.round(total * presentPct);
    const late = Math.round(total * 0.032);
    const absent = total - present - late;
    return { date: label, present, absent, late };
  });
}

function buildPayrollByDepartment(): PayrollDeptPoint[] {
  const costs = [
    ["Weaving", 1_842_000],
    ["Spinning", 1_566_000],
    ["Dyeing", 1_128_000],
    ["Finishing", 842_000],
    ["Quality Control", 511_000],
    ["Warehouse", 398_000],
    ["Maintenance", 356_000],
    ["Administration", 274_000],
  ] as const;
  return costs.map(([department, cost]) => ({ department, cost }));
}

function buildPayrollTrend(): PayrollTrendPoint[] {
  const labels = [
    "Oct",
    "Nov",
    "Dec",
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
  ];
  const base = 6_450_000;
  return labels.map((period, i) => ({
    period,
    amount: Math.round(base * (1 + i * 0.018 + Math.sin(i / 2.5) * 0.02)),
  }));
}

function buildEmploymentTypeBreakdown(): EmploymentTypePoint[] {
  return [
    { type: "Permanent", amount: 5_640_000, headcount: 312 },
    { type: "Daily Wage", amount: 2_178_000, headcount: 174 },
  ];
}

function buildRecentPayrollRuns(): PayrollRun[] {
  return [
    {
      id: "run-2609",
      period: "Sep 1 – Sep 15, 2026",
      runDate: "2026-09-16",
      employeesPaid: 486,
      totalAmount: 3_912_000,
      status: "completed",
    },
    {
      id: "run-2608",
      period: "Aug 16 – Aug 31, 2026",
      runDate: "2026-09-01",
      employeesPaid: 481,
      totalAmount: 3_864_000,
      status: "completed",
    },
    {
      id: "run-2607",
      period: "Aug 1 – Aug 15, 2026",
      runDate: "2026-08-16",
      employeesPaid: 478,
      totalAmount: 3_801_000,
      status: "completed",
    },
    {
      id: "run-2606",
      period: "Jul 16 – Jul 31, 2026",
      runDate: "2026-08-01",
      employeesPaid: 474,
      totalAmount: 3_756_000,
      status: "completed",
    },
    {
      id: "run-2605",
      period: "Sep 16 – Sep 30, 2026",
      runDate: "2026-10-01",
      employeesPaid: 486,
      totalAmount: 3_940_000,
      status: "processing",
    },
  ];
}

export const mockWorkforceData: WorkforceApiResponse = {
  kpis: {
    totalEmployees: 486,
    presentToday: 452,
    absentToday: 21,
    onPayrollThisCycle: 486,
    presentPct: Math.round((452 / 486) * 1000) / 10,
    employeesDelta7d: 6,
  },
  attendanceDaily: buildAttendanceDaily(),
  attendanceWeekly: buildAttendanceWeekly(),
  attendanceMonthly: buildAttendanceMonthly(),
  payrollByDepartment: buildPayrollByDepartment(),
  payrollTrend: buildPayrollTrend(),
  employmentTypeBreakdown: buildEmploymentTypeBreakdown(),
  latestPostedDate: isoDaysAgo(1),
  recentPayrollRuns: buildRecentPayrollRuns(),
};
