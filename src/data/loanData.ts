// Shapes for the Loans page. Everything here is read from the Frappe site's
// custom `loan_management` app; nothing is estimated in the browser.

/** `HR Loan.status` options, as declared on the doctype. */
export type LoanStatus = "Sanctioned" | "Disbursed" | "Closed" | "Cancelled";

/** `HR Loan.loan_source` options, as declared on the doctype. */
export type LoanSource = "Salary" | "Bonus" | "Gratuity";

/** `Employee.status` — the borrower's current employment status. */
export type EmployeeStatus = "Active" | "Inactive" | "Suspended" | "Left";

/**
 * One row of the "HR Loan Summary" script report — the same row the ATS desk
 * shows. Field names mirror the report's `fieldname`s one-to-one so nothing is
 * renamed or re-derived on the way in.
 */
export interface LoanRecord {
  loan: string;
  employee: string;
  employeeName: string;
  department: string;
  loanType: string;
  loanSource: LoanSource | string;
  /** ISO date or null when the loan has not been disbursed. */
  disbursementDate: string | null;
  loanAmount: number;
  monthlyInstallmentAmount: number;
  /** `HR Loan.repayment_periods` — the report's "Total Installments". */
  repaymentPeriods: number;
  /** Count of repayment-schedule rows with `is_paid = 1`, per the report. */
  paidInstallments: number;
  /** Count of repayment-schedule rows with `is_paid = 0`, per the report. */
  pendingInstallments: number;
  totalAmountPaid: number;
  balanceAmount: number;
  status: LoanStatus | string;

  // ── Joined from other doctypes (not part of the report) ──
  /** From `Employee.status`; null if the employee could not be read. */
  employeeStatus: EmployeeStatus | string | null;
  /** Cross-checks of the loan's own repayment schedule against its header. */
  checks: LoanIntegrity | null;
}

/**
 * What the loan's `repayment_schedule` child table says, next to what the
 * header fields (and therefore the report) say. Where the two disagree the
 * page still shows the report's figures, but flags the row.
 */
export interface LoanIntegrity {
  /** Number of rows in the repayment schedule. */
  scheduleRows: number;
  /** Sum of `total_payment` over every schedule row. */
  scheduledTotal: number;
  /** Sum of `total_payment` over rows flagged `is_paid`. */
  schedulePaidTotal: number;
  /** Human-readable discrepancies; empty when everything reconciles. */
  issues: string[];
}

/** One card from the report's `report_summary`, exactly as the server sent it. */
export interface LoanSummaryCard {
  label: string;
  value: number;
  datatype: "Int" | "Currency" | string;
  indicator: string;
}

/** The report's own chart (`Top 10 Employees by Outstanding Loan Balance`). */
export interface LoanReportChart {
  title: string;
  series: string;
  points: { label: string; value: number }[];
}

export interface LoanReport {
  records: LoanRecord[];
  /** Null when the report returned no rows (Frappe sends `report_summary: null`). */
  summary: LoanSummaryCard[] | null;
  chart: LoanReportChart | null;
  /** Seconds the server spent executing the report. */
  executionTime: number | null;
  /** Whether the Employee join / schedule cross-check could be read. */
  joins: { employeeStatus: boolean; schedule: boolean };
}

/** A row of `HR Loan Repayment Schedule`, from the loan document. */
export interface LoanScheduleRow {
  idx: number;
  paymentDate: string;
  principalAmount: number;
  interestAmount: number;
  totalPayment: number;
  balanceAfterPayment: number;
  isPaid: boolean;
  paidOn: string | null;
  salarySlip: string | null;
}

/** The full `HR Loan` document, for the detail drawer. */
export interface LoanDetail {
  name: string;
  employee: string;
  employeeName: string;
  company: string;
  loanApplication: string | null;
  loanType: string;
  loanSource: string;
  loanAmount: number;
  monthlyInstallmentAmount: number;
  repaymentPeriods: number;
  rateOfInterest: number;
  monthlyRepaymentAmount: number;
  totalInterestPayable: number;
  totalPayableAmount: number;
  totalAmountPaid: number;
  balanceAmount: number;
  disbursementDate: string | null;
  status: string;
  loanAccount: string | null;
  paymentAccount: string | null;
  disbursementJournalEntry: string | null;
  created: string;
  modified: string;
  schedule: LoanScheduleRow[];
}
