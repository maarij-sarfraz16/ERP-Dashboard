// Expense claims come from HRMS's standard `Expense Claim` doctype, which this
// site has extended with `custom_*` fields for its medical-reimbursement
// process (expense type, bill month, salary, medical entitlement, remaining
// balance) and a Workflow whose state lives in `workflow_state`.
//
// Data flow:  tabExpense Claim (+ tabExpense Claim Detail)
//               → /api/resource/Expense Claim   (one unpaginated list read)
//               → this module → ExpenseClaimsPage
//
// There is no desk report to mirror — the desk shows the plain list view —
// so the page reads the headers as stored. The two joins below (the
// claimant's `Employee.status`, and a per-claim / per-beneficiary aggregate
// over the `expenses` child rows) are optional: if either fails the page
// still renders.
//
// Cancelled claims (docstatus 2) are included; the list API returns every
// docstatus unless filtered, and cancelled claims are real history.

import { getDoc, getList, optional } from "./frappeClient";
import { toNumber } from "./frappeMappers";
import type {
  BeneficiarySplit,
  ClaimBeneficiary,
  ExpenseClaimAdvanceRow,
  ExpenseClaimDetail,
  ExpenseClaimLine,
  ExpenseClaimRecord,
  ExpenseClaimReport,
  ExpenseClaimTaxRow,
} from "../data/expenseClaimData";

export const EXPENSE_CLAIM_DOCTYPE = "Expense Claim";
export const EXPENSE_CLAIM_DETAIL_DOCTYPE = "Expense Claim Detail";

// ── Raw shapes, exactly as Frappe returns them ─────────────────────────────

interface RawClaimHeader {
  name: string;
  employee: string | null;
  employee_name: string | null;
  department: string | null;
  company: string | null;
  custom_expense_type: string | null;
  expense_approver: string | null;
  workflow_state: string | null;
  approval_status: string | null;
  status: string | null;
  docstatus: number;
  custom_designation: string | null;
  custom_marital_status: string | null;
  custom_bill_of_month: string | null;
  custom_salary: string | number | null;
  custom_medical_amount: number | string | null;
  custom_remaining_balance_: number | string | null;
  total_claimed_amount: number | string | null;
  total_sanctioned_amount: number | string | null;
  total_taxes_and_charges: number | string | null;
  total_advance_amount: number | string | null;
  grand_total: number | string | null;
  total_amount_reimbursed: number | string | null;
  posting_date: string;
  is_paid: number | boolean;
  mode_of_payment: string | null;
  clearance_date: string | null;
  payable_account: string | null;
  cost_center: string | null;
  project: string | null;
  remark: string | null;
  owner: string;
  modified_by: string;
  creation: string;
  modified: string;
}

interface RawClaimDoc extends RawClaimHeader {
  amended_from: string | null;
  expenses: RawLine[] | null;
  advances: RawAdvance[] | null;
  taxes: RawTax[] | null;
}

interface RawLine {
  idx: number;
  expense_date: string | null;
  expense_type: string | null;
  custom_claim_type: string | null;
  custom_doctorhospital: string | null;
  custom_medicine_bill: string | null;
  custom_lab_test: string | null;
  custom_emergency_bill: string | null;
  amount: number | string | null;
  sanctioned_amount: number | string | null;
  description: string | null;
  default_account: string | null;
  cost_center: string | null;
}

interface RawAdvance {
  employee_advance: string;
  posting_date: string | null;
  advance_paid: number | string | null;
  unclaimed_amount: number | string | null;
  allocated_amount: number | string | null;
}

interface RawTax {
  account_head: string;
  rate: number | string | null;
  tax_amount: number | string | null;
  total: number | string | null;
  description: string | null;
}

interface RawLineAggregate {
  parent: string;
  custom_claim_type: string | null;
  line_count: number | string;
  amount: number | string | null;
  sanctioned: number | string | null;
}

const HEADER_FIELDS: (keyof RawClaimHeader)[] = [
  "name",
  "employee",
  "employee_name",
  "department",
  "company",
  "custom_expense_type",
  "expense_approver",
  "workflow_state",
  "approval_status",
  "status",
  "docstatus",
  "custom_designation",
  "custom_marital_status",
  "custom_bill_of_month",
  "custom_salary",
  "custom_medical_amount",
  "custom_remaining_balance_",
  "total_claimed_amount",
  "total_sanctioned_amount",
  "total_taxes_and_charges",
  "total_advance_amount",
  "grand_total",
  "total_amount_reimbursed",
  "posting_date",
  "is_paid",
  "mode_of_payment",
  "clearance_date",
  "payable_account",
  "cost_center",
  "project",
  "remark",
  "owner",
  "modified_by",
  "creation",
  "modified",
];

// ── Mapping ────────────────────────────────────────────────────────────────

function docstatusOf(v: number): 0 | 1 | 2 {
  return v === 1 ? 1 : v === 2 ? 2 : 0;
}

function mapHeader(raw: RawClaimHeader): Omit<ExpenseClaimRecord, "employeeStatus" | "split"> {
  return {
    name: raw.name,
    employee: (raw.employee ?? "").trim(),
    employeeName: raw.employee_name?.trim() || (raw.employee ?? "").trim(),
    department: raw.department?.trim() || "",
    designation: raw.custom_designation?.trim() || "",
    maritalStatus: raw.custom_marital_status?.trim() || "",
    company: raw.company ?? "",
    expenseType: raw.custom_expense_type?.trim() || "",
    expenseApprover: raw.expense_approver ?? "",
    workflowState: raw.workflow_state?.trim() || "",
    approvalStatus: raw.approval_status?.trim() || "",
    status: raw.status?.trim() || "",
    docstatus: docstatusOf(Number(raw.docstatus)),
    billOfMonth: raw.custom_bill_of_month?.trim() || "",
    salary: toNumber(raw.custom_salary),
    medicalAmount: toNumber(raw.custom_medical_amount),
    remainingBalance: toNumber(raw.custom_remaining_balance_),
    totalClaimedAmount: toNumber(raw.total_claimed_amount),
    totalSanctionedAmount: toNumber(raw.total_sanctioned_amount),
    totalTaxesAndCharges: toNumber(raw.total_taxes_and_charges),
    totalAdvanceAmount: toNumber(raw.total_advance_amount),
    grandTotal: toNumber(raw.grand_total),
    totalAmountReimbursed: toNumber(raw.total_amount_reimbursed),
    postingDate: raw.posting_date,
    isPaid: Boolean(Number(raw.is_paid)),
    modeOfPayment: raw.mode_of_payment || null,
    clearanceDate: raw.clearance_date || null,
    payableAccount: raw.payable_account || null,
    costCenter: raw.cost_center || null,
    project: raw.project || null,
    remark: raw.remark?.trim() || null,
    owner: raw.owner,
    modifiedBy: raw.modified_by,
    created: raw.creation,
    modified: raw.modified,
  };
}

function beneficiaryOf(v: string | null): ClaimBeneficiary | "" {
  const t = (v ?? "").trim();
  return t === "Self" || t === "Wife" || t === "Son" || t === "Daughter" ? t : "";
}

/** `Employee.status` for a set of employee ids. */
async function fetchEmployeeStatuses(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await getList<{ name: string; status: string | null }>("Employee", {
    fields: ["name", "status"],
    filters: [["name", "in", ids]],
    limit: 0,
  });
  return new Map(rows.map((r) => [r.name, r.status ?? ""]));
}

/** Per-claim, per-beneficiary sums over `Expense Claim Detail`. */
async function fetchLineSplits(): Promise<Map<string, BeneficiarySplit[]>> {
  const rows = await getList<RawLineAggregate>(EXPENSE_CLAIM_DETAIL_DOCTYPE, {
    fields: [
      "parent",
      "custom_claim_type",
      "count(name) as line_count",
      "sum(amount) as amount",
      "sum(sanctioned_amount) as sanctioned",
    ],
    filters: [["parenttype", "=", EXPENSE_CLAIM_DOCTYPE]],
    parent: EXPENSE_CLAIM_DOCTYPE,
    groupBy: "parent,custom_claim_type",
    limit: 0,
  });
  const map = new Map<string, BeneficiarySplit[]>();
  for (const r of rows) {
    const list = map.get(r.parent) ?? [];
    list.push({
      beneficiary: beneficiaryOf(r.custom_claim_type),
      lines: toNumber(r.line_count),
      amount: toNumber(r.amount),
      sanctioned: toNumber(r.sanctioned),
    });
    map.set(r.parent, list);
  }
  return map;
}

export async function fetchExpenseClaims(): Promise<ExpenseClaimReport> {
  const [headers, splits] = await Promise.all([
    getList<RawClaimHeader>(EXPENSE_CLAIM_DOCTYPE, {
      fields: HEADER_FIELDS,
      orderBy: "posting_date desc, name desc",
      limit: 0,
    }),
    optional("Expense Claim Detail aggregates", fetchLineSplits(), null),
  ]);

  const seen = new Set<string>();
  const records: ExpenseClaimRecord[] = [];
  for (const raw of headers) {
    if (!raw.name || seen.has(raw.name)) {
      console.warn("[frappe] Expense Claim list returned a blank or duplicate row", raw);
      continue;
    }
    seen.add(raw.name);
    records.push({ ...mapHeader(raw), employeeStatus: null, split: null });
  }

  const statuses = await optional(
    "Employee statuses for claimants",
    fetchEmployeeStatuses([...new Set(records.map((r) => r.employee).filter(Boolean))]),
    null,
  );

  for (const r of records) {
    if (statuses) r.employeeStatus = statuses.get(r.employee) ?? null;
    if (splits) r.split = splits.get(r.name) ?? [];
  }

  return { records, joins: { employeeStatus: statuses !== null, lines: splits !== null } };
}

// ── One claim, with its lines ──────────────────────────────────────────────

export async function fetchExpenseClaimDetail(name: string): Promise<ExpenseClaimDetail> {
  const doc = await getDoc<RawClaimDoc>(EXPENSE_CLAIM_DOCTYPE, name);
  const expenses: ExpenseClaimLine[] = (doc.expenses ?? []).map((l) => ({
    idx: toNumber(l.idx),
    expenseDate: l.expense_date || null,
    expenseType: l.expense_type?.trim() || "",
    claimType: beneficiaryOf(l.custom_claim_type),
    doctorHospital: l.custom_doctorhospital?.trim() || "",
    medicineBill: l.custom_medicine_bill?.trim() || "",
    labTest: l.custom_lab_test?.trim() || "",
    emergencyBill: l.custom_emergency_bill?.trim() || "",
    amount: toNumber(l.amount),
    sanctionedAmount: toNumber(l.sanctioned_amount),
    // Text Editor fields carry HTML; the drawer shows the text only.
    description: (l.description ?? "").replace(/<[^>]+>/g, "").trim(),
    defaultAccount: l.default_account || null,
    costCenter: l.cost_center || null,
  }));
  const advances: ExpenseClaimAdvanceRow[] = (doc.advances ?? []).map((a) => ({
    employeeAdvance: a.employee_advance,
    postingDate: a.posting_date || null,
    advancePaid: toNumber(a.advance_paid),
    unclaimedAmount: toNumber(a.unclaimed_amount),
    allocatedAmount: toNumber(a.allocated_amount),
  }));
  const taxes: ExpenseClaimTaxRow[] = (doc.taxes ?? []).map((t) => ({
    accountHead: t.account_head,
    rate: toNumber(t.rate),
    taxAmount: toNumber(t.tax_amount),
    total: toNumber(t.total),
    description: t.description?.trim() || "",
  }));
  return { ...mapHeader(doc), amendedFrom: doc.amended_from || null, expenses, advances, taxes };
}
