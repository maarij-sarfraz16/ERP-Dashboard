import type { ExpenseClaimRecord } from "../../data/expenseClaimData";

export type SortKey =
  | "name"
  | "employee"
  | "employeeName"
  | "department"
  | "designation"
  | "expenseType"
  | "billOfMonth"
  | "postingDate"
  | "totalClaimedAmount"
  | "totalSanctionedAmount"
  | "totalAmountReimbursed"
  | "medicalAmount"
  | "remainingBalance"
  | "workflowState"
  | "status";

export interface SortState {
  key: SortKey;
  dir: 1 | -1;
}

/** Columns in the desk list view's order, with its labels. */
export const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "name", label: "Claim ID", numeric: false },
  { key: "employee", label: "Employee ID", numeric: false },
  { key: "employeeName", label: "Employee Name", numeric: false },
  { key: "department", label: "Department", numeric: false },
  { key: "designation", label: "Designation", numeric: false },
  { key: "expenseType", label: "Expense Type", numeric: false },
  { key: "billOfMonth", label: "Bill Month", numeric: false },
  { key: "postingDate", label: "Posting Date", numeric: false },
  { key: "totalClaimedAmount", label: "Claimed", numeric: true },
  { key: "totalSanctionedAmount", label: "Sanctioned", numeric: true },
  { key: "totalAmountReimbursed", label: "Reimbursed", numeric: true },
  { key: "medicalAmount", label: "Medical Entitlement", numeric: true },
  { key: "remainingBalance", label: "Remaining Balance", numeric: true },
  { key: "workflowState", label: "Workflow", numeric: false },
  { key: "status", label: "Payment", numeric: false },
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function compareClaims(a: ExpenseClaimRecord, b: ExpenseClaimRecord, key: SortKey): number {
  const x = a[key];
  const y = b[key];
  if (typeof x === "number" && typeof y === "number") return x - y;
  if (key === "billOfMonth") return MONTHS.indexOf(String(x)) - MONTHS.indexOf(String(y));
  return String(x ?? "").localeCompare(String(y ?? ""), undefined, { numeric: true });
}

export interface VisibleTotals {
  count: number;
  employees: number;
  totalClaimedAmount: number;
  totalSanctionedAmount: number;
  totalAmountReimbursed: number;
  medicalAmount: number;
  remainingBalance: number;
}

export function totalsOf(rows: ExpenseClaimRecord[]): VisibleTotals {
  const t: VisibleTotals = {
    count: rows.length,
    employees: 0,
    totalClaimedAmount: 0,
    totalSanctionedAmount: 0,
    totalAmountReimbursed: 0,
    medicalAmount: 0,
    remainingBalance: 0,
  };
  const employees = new Set<string>();
  for (const r of rows) {
    employees.add(r.employee);
    t.totalClaimedAmount += r.totalClaimedAmount;
    t.totalSanctionedAmount += r.totalSanctionedAmount;
    t.totalAmountReimbursed += r.totalAmountReimbursed;
    t.medicalAmount += r.medicalAmount;
    t.remainingBalance += r.remainingBalance;
  }
  t.employees = employees.size;
  return t;
}
