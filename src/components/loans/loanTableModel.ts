import type { LoanRecord } from "../../data/loanData";

export type SortKey =
  | "loan"
  | "employee"
  | "employeeName"
  | "department"
  | "loanSource"
  | "disbursementDate"
  | "loanAmount"
  | "monthlyInstallmentAmount"
  | "repaymentPeriods"
  | "paidInstallments"
  | "pendingInstallments"
  | "totalAmountPaid"
  | "balanceAmount"
  | "status";

export interface SortState {
  key: SortKey;
  dir: 1 | -1;
}

/** Columns in the report's own order, with its labels. */
export const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "loan", label: "Loan ID", numeric: false },
  { key: "employee", label: "Employee ID", numeric: false },
  { key: "employeeName", label: "Employee Name", numeric: false },
  { key: "department", label: "Department", numeric: false },
  { key: "loanSource", label: "Repayment Source", numeric: false },
  { key: "disbursementDate", label: "Disbursement Date", numeric: false },
  { key: "loanAmount", label: "Loan Amount", numeric: true },
  { key: "monthlyInstallmentAmount", label: "Monthly Installment", numeric: true },
  { key: "repaymentPeriods", label: "Total Installments", numeric: true },
  { key: "paidInstallments", label: "Paid Installments", numeric: true },
  { key: "pendingInstallments", label: "Pending Installments", numeric: true },
  { key: "totalAmountPaid", label: "Amount Paid", numeric: true },
  { key: "balanceAmount", label: "Balance Remaining", numeric: true },
  { key: "status", label: "Status", numeric: false },
];

export function compareLoans(a: LoanRecord, b: LoanRecord, key: SortKey): number {
  const x = a[key];
  const y = b[key];
  if (typeof x === "number" && typeof y === "number") return x - y;
  return String(x ?? "").localeCompare(String(y ?? ""), undefined, { numeric: true });
}

export interface VisibleTotals {
  count: number;
  loanAmount: number;
  totalAmountPaid: number;
  balanceAmount: number;
  repaymentPeriods: number;
  paidInstallments: number;
  pendingInstallments: number;
}

export function totalsOf(rows: LoanRecord[]): VisibleTotals {
  const t: VisibleTotals = {
    count: rows.length,
    loanAmount: 0,
    totalAmountPaid: 0,
    balanceAmount: 0,
    repaymentPeriods: 0,
    paidInstallments: 0,
    pendingInstallments: 0,
  };
  for (const r of rows) {
    t.loanAmount += r.loanAmount;
    t.totalAmountPaid += r.totalAmountPaid;
    t.balanceAmount += r.balanceAmount;
    t.repaymentPeriods += r.repaymentPeriods;
    t.paidInstallments += r.paidInstallments;
    t.pendingInstallments += r.pendingInstallments;
  }
  return t;
}
