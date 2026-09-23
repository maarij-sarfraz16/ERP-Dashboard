// Shapes for the Expense Claims page. Everything here is read from HRMS's
// `Expense Claim` doctype (plus this site's `custom_*` fields); nothing is
// estimated in the browser.

/** `Expense Claim.status` options, as declared on the doctype. */
export type ExpenseClaimStatus = "Draft" | "Paid" | "Unpaid" | "Rejected" | "Submitted" | "Cancelled";

/** `Expense Claim.approval_status` options. */
export type ApprovalStatus = "Draft" | "Approved" | "Rejected";

/**
 * `Expense Claim.workflow_state` — the site's approval workflow. These are
 * the states seen on the site; the type stays open because workflow states
 * are data, not schema.
 */
export type WorkflowState = "Pending" | "forward to Auditor" | "Review" | "Approved" | "Rejected" | string;

/** `Expense Claim Detail.custom_claim_type` — who the bill was for. */
export type ClaimBeneficiary = "Self" | "Wife" | "Son" | "Daughter";

export const CLAIM_BENEFICIARIES: ClaimBeneficiary[] = ["Self", "Wife", "Son", "Daughter"];

/** `Employee.status` — the claimant's current employment status. */
export type EmployeeStatus = "Active" | "Inactive" | "Suspended" | "Left";

/** Per-beneficiary split of one claim's expense lines. */
export interface BeneficiarySplit {
  beneficiary: ClaimBeneficiary | "";
  lines: number;
  amount: number;
  sanctioned: number;
}

/**
 * One `Expense Claim` header, field-for-field. Field names mirror the
 * doctype's fieldnames (minus the `custom_` prefix) so nothing is renamed or
 * re-derived on the way in.
 */
export interface ExpenseClaimRecord {
  name: string;
  employee: string;
  employeeName: string;
  department: string;
  designation: string;
  maritalStatus: string;
  company: string;
  /** `custom_expense_type` — the claim-level Expense Claim Type. */
  expenseType: string;
  expenseApprover: string;
  workflowState: WorkflowState;
  approvalStatus: ApprovalStatus | string;
  status: ExpenseClaimStatus | string;
  /** 0 = draft, 1 = submitted, 2 = cancelled. */
  docstatus: 0 | 1 | 2;
  /** `custom_bill_of_month` — the month the bills belong to. */
  billOfMonth: string;
  /** `custom_salary` — stored as text on the doctype. */
  salary: number;
  /** `custom_medical_amount` — the employee's medical entitlement. */
  medicalAmount: number;
  /** `custom_remaining_balance_` — entitlement left, as stored on the claim. */
  remainingBalance: number;
  totalClaimedAmount: number;
  totalSanctionedAmount: number;
  totalTaxesAndCharges: number;
  totalAdvanceAmount: number;
  grandTotal: number;
  totalAmountReimbursed: number;
  postingDate: string;
  isPaid: boolean;
  modeOfPayment: string | null;
  clearanceDate: string | null;
  payableAccount: string | null;
  costCenter: string | null;
  project: string | null;
  remark: string | null;
  owner: string;
  modifiedBy: string;
  created: string;
  modified: string;

  // ── Joined from other doctypes (not part of the header) ──
  /** From `Employee.status`; null if the employee could not be read. */
  employeeStatus: EmployeeStatus | string | null;
  /** Aggregated over the claim's `expenses` rows; null if they could not be read. */
  split: BeneficiarySplit[] | null;
}

/** A row of `Expense Claim Detail`, from the claim document. */
export interface ExpenseClaimLine {
  idx: number;
  expenseDate: string | null;
  expenseType: string;
  claimType: ClaimBeneficiary | "";
  /** The site's four bill columns are free-text (`Data`) fields. */
  doctorHospital: string;
  medicineBill: string;
  labTest: string;
  emergencyBill: string;
  amount: number;
  sanctionedAmount: number;
  description: string;
  defaultAccount: string | null;
  costCenter: string | null;
}

/** A row of `Expense Claim Advance`. */
export interface ExpenseClaimAdvanceRow {
  employeeAdvance: string;
  postingDate: string | null;
  advancePaid: number;
  unclaimedAmount: number;
  allocatedAmount: number;
}

/** A row of `Expense Taxes and Charges`. */
export interface ExpenseClaimTaxRow {
  accountHead: string;
  rate: number;
  taxAmount: number;
  total: number;
  description: string;
}

/** The full `Expense Claim` document, for the detail drawer. */
export interface ExpenseClaimDetail extends Omit<ExpenseClaimRecord, "employeeStatus" | "split"> {
  amendedFrom: string | null;
  expenses: ExpenseClaimLine[];
  advances: ExpenseClaimAdvanceRow[];
  taxes: ExpenseClaimTaxRow[];
}

export interface ExpenseClaimReport {
  records: ExpenseClaimRecord[];
  /** Whether the Employee join / expense-line split could be read. */
  joins: { employeeStatus: boolean; lines: boolean };
}
