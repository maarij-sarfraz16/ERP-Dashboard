// Mock data shaped like a real REST API response payload.
// Swap `fetchEmployeeData()` in `src/hooks/useEmployeeData.ts` for a real
// `fetch('/api/employees')` call later — no component code needs to change.

import type { EmploymentType } from "./mockData";

export type EmployeeStatus = "active" | "on-leave" | "exited";
export type DayMark = "present" | "late" | "absent";

export interface Employee {
  id: string;
  name: string;
  initials: string;
  role: string;
  department: string;
  employmentType: EmploymentType;
  joinDate: string;
  status: EmployeeStatus;
  attendance14d: DayMark[];
}

export interface DepartmentHeadcount {
  department: string;
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

export interface EmployeeApiResponse {
  totalActive: number;
  activeDelta7d: number;
  dailyWageCount: number;
  newHiresThisQuarter: number;
  presentTodayPct: number;
  headcountByDepartment: DepartmentHeadcount[];
  employmentTypeSplit: EmploymentSplitPoint[];
  newHiresByMonth: NewHirePoint[];
  employees: Employee[];
}

const DEPARTMENTS = ["IT", "Account", "Labour", "HR"];

const ROLES_BY_DEPT: Record<string, string[]> = {
  IT: ["IT Officer", "IT Executive", "IT Manager"],
  Account: ["Accounts Clerk", "Accountant", "Accounts Manager"],
  Labour: ["Labour Supervisor", "Line Worker", "Labour Coordinator"],
  HR: ["HR Executive", "HR Officer", "HR Manager"],
};

const NAMES = [
  "Ahmed Raza", "Ayesha Khan", "Muhammad Bilal", "Sana Fatima", "Usman Tariq",
  "Sadia Nawaz", "Bilal Hussain", "Rabia Yousaf", "Imran Sheikh", "Mehwish Iqbal",
  "Kashif Mahmood", "Nadia Parveen", "Faisal Mehmood", "Hina Shahzad", "Tariq Aziz",
  "Saima Riaz", "Adnan Malik", "Farah Naz", "Waseem Akram", "Zainab Hussain",
  "Junaid Anwar", "Amna Siddiqui", "Shahid Latif", "Rukhsana Bibi", "Naveed Ahmad",
  "Farida Yasmin", "Asif Javed", "Nida Aslam", "Rizwan Qureshi", "Shazia Perveen",
  "Zeeshan Haider", "Iram Shahid", "Mudassar Iqbal", "Saba Noreen", "Aamir Farooq",
  "Kiran Zahid", "Waqas Ahmed", "Tehmina Kausar", "Ali Raza", "Fozia Batool",
];

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function isoMonthsAgo(monthsAgo: number, dayOfMonth = 8): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - monthsAgo);
  d.setDate(dayOfMonth);
  return d.toISOString().slice(0, 10);
}

function buildAttendance14d(seed: number, reliability: number): DayMark[] {
  const marks: DayMark[] = [];
  for (let i = 0; i < 14; i++) {
    const roll = (Math.sin(seed * 7.13 + i * 2.7) + 1) / 2;
    if (roll > reliability) marks.push("absent");
    else if (roll > reliability - 0.08) marks.push("late");
    else marks.push("present");
  }
  return marks;
}

function buildEmployees(): Employee[] {
  return NAMES.map((name, i) => {
    const department = DEPARTMENTS[i % DEPARTMENTS.length];
    const roles = ROLES_BY_DEPT[department];
    const role = roles[i % roles.length];
    const employmentType: EmploymentType = i % 5 === 0 ? "Daily Wage" : "Permanent";
    const status: EmployeeStatus = i % 13 === 0 ? "on-leave" : i % 19 === 0 ? "exited" : "active";
    const tenureMonths = 3 + ((i * 5) % 84);
    const reliability = 0.82 + ((i * 3) % 15) / 100;

    return {
      id: `emp-${1000 + i}`,
      name,
      initials: initialsOf(name),
      role,
      department,
      employmentType,
      joinDate: isoMonthsAgo(tenureMonths, 4 + (i % 24)),
      status,
      attendance14d: buildAttendance14d(i, reliability),
    };
  });
}

function buildHeadcountByDepartment(employees: Employee[]): DepartmentHeadcount[] {
  const counts = new Map<string, number>();
  for (const e of employees) counts.set(e.department, (counts.get(e.department) ?? 0) + 1);
  return DEPARTMENTS.map((department) => ({
    department,
    count: counts.get(department) ?? 0,
  })).sort((a, b) => b.count - a.count);
}

function buildEmploymentTypeSplit(): EmploymentSplitPoint[] {
  return [
    { type: "Permanent", count: 1871 },
    { type: "Daily Wage", count: 339 },
  ];
}

function buildNewHiresByMonth(): NewHirePoint[] {
  const labels = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"];
  return labels.map((month, i) => ({
    month,
    count: Math.round(6 + Math.abs(Math.sin(i / 2.2)) * 20),
  }));
}

const employees = buildEmployees();

export const mockEmployeeData: EmployeeApiResponse = {
  totalActive: 2210,
  activeDelta7d: 1,
  dailyWageCount: 359,
  newHiresThisQuarter: 14,
  presentTodayPct: 97,
  headcountByDepartment: buildHeadcountByDepartment(employees),
  employmentTypeSplit: buildEmploymentTypeSplit(),
  newHiresByMonth: buildNewHiresByMonth(),
  employees,
};
