// Loans come from the ATS site's custom `loan_management` app. The desk's own
// view of them is the script report "HR Loan Summary" (module "HR Loan
// Management", ref doctype `HR Loan`), which is what this module runs — via
// the same `frappe.desk.query_report.run` call the desk report page makes, so
// rows, the five summary cards and the chart are all decided on the server.
//
// Data flow:  tabHR Loan (+ tabHR Loan Repayment Schedule)
//               → loan_management/.../hr_loan_summary.py
//               → frappe.desk.query_report.run
//               → this module → LoansPage
//
// Nothing here is estimated or re-derived. The two joins below (the
// borrower's `Employee.status`, and an aggregate over each loan's repayment
// schedule used only to *flag* rows whose schedule disagrees with the header)
// are optional: if either read fails the report still renders.
//
// NOTE the report is not paginated — `query_report.run` returns every row in
// one response — and it is slow (~10 s on this site, since it queries the
// schedule per loan), hence the extended timeout.

import { callMethod, getDoc, getList, optional } from "./frappeClient";
import { toNumber } from "./frappeMappers";
import type {
  LoanDetail,
  LoanIntegrity,
  LoanRecord,
  LoanReport,
  LoanReportChart,
  LoanScheduleRow,
  LoanSummaryCard,
} from "../data/loanData";

export const LOAN_REPORT_NAME = "HR Loan Summary";
export const LOAN_DOCTYPE = "HR Loan";
export const LOAN_SCHEDULE_DOCTYPE = "HR Loan Repayment Schedule";

/** The report can take well over the default 20 s budget. */
const REPORT_TIMEOUT_MS = 90_000;

// ── Raw shapes, exactly as Frappe returns them ─────────────────────────────

interface RawReportRow {
  loan: string;
  employee: string | null;
  employee_name: string | null;
  department: string | null;
  loan_type: string | null;
  loan_source: string | null;
  disbursement_date: string | null;
  loan_amount: number | string | null;
  monthly_installment_amount: number | string | null;
  repayment_periods: number | string | null;
  total_amount_paid: number | string | null;
  balance_amount: number | string | null;
  status: string | null;
  paid_installments: number | string | null;
  pending_installments: number | string | null;
}

interface RawReportResult {
  result: (RawReportRow | unknown[])[] | null;
  report_summary: LoanSummaryCard[] | null;
  chart: {
    title?: string;
    data?: { labels?: string[]; datasets?: { name?: string; values?: number[] }[] };
  } | null;
  execution_time?: number | null;
}

interface RawScheduleAggregate {
  parent: string;
  row_count: number | string;
  scheduled: number | string | null;
}

interface RawSchedulePaidAggregate {
  parent: string;
  paid_amount: number | string | null;
}

interface RawScheduleRow {
  idx: number;
  payment_date: string;
  principal_amount: number | string | null;
  interest_amount: number | string | null;
  total_payment: number | string | null;
  balance_loan_amount: number | string | null;
  is_paid: number | boolean;
  paid_on: string | null;
  salary_slip: string | null;
}

interface RawLoanDoc {
  name: string;
  employee: string;
  employee_name: string | null;
  company: string;
  loan_application: string | null;
  loan_type: string;
  loan_source: string | null;
  loan_amount: number | string | null;
  monthly_installment_amount: number | string | null;
  repayment_periods: number | string | null;
  rate_of_interest: number | string | null;
  monthly_repayment_amount: number | string | null;
  total_interest_payable: number | string | null;
  total_payable_amount: number | string | null;
  total_amount_paid: number | string | null;
  balance_amount: number | string | null;
  disbursement_date: string | null;
  status: string;
  loan_account: string | null;
  payment_account: string | null;
  disbursement_journal_entry: string | null;
  creation: string;
  modified: string;
  repayment_schedule: RawScheduleRow[] | null;
}

// ── Report ─────────────────────────────────────────────────────────────────

/** Script reports may return rows as dicts or as positional arrays. */
function isObjectRow(row: RawReportRow | unknown[]): row is RawReportRow {
  return !!row && typeof row === "object" && !Array.isArray(row);
}

function runReport(): Promise<RawReportResult> {
  // No filters: the desk's default filter set (company = user default,
  // to_date = today) is a no-op on this site — one company, every loan
  // disbursed in the past — and passing nothing guarantees every loan the
  // report knows about is returned, including any dated in the future.
  return callMethod<RawReportResult>(
    "frappe.desk.query_report.run",
    { report_name: LOAN_REPORT_NAME, filters: {}, ignore_prepared_report: 1 },
    { timeoutMs: REPORT_TIMEOUT_MS },
  );
}

function mapChart(raw: RawReportResult["chart"]): LoanReportChart | null {
  const labels = raw?.data?.labels;
  const dataset = raw?.data?.datasets?.[0];
  if (!labels?.length || !dataset?.values?.length) return null;
  return {
    title: raw?.title ?? "",
    series: dataset.name ?? "",
    points: labels.map((label, i) => ({ label, value: toNumber(dataset.values?.[i]) })),
  };
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

/**
 * Per-loan aggregates over `HR Loan Repayment Schedule` — two grouped reads
 * (Frappe's list API allows `count`/`sum` but not `if()`), so the paid total
 * comes from a second query filtered on `is_paid`.
 */
async function fetchScheduleAggregates(): Promise<
  Map<string, { rows: number; scheduled: number; paid: number }>
> {
  const common = {
    filters: [["parenttype", "=", LOAN_DOCTYPE]],
    parent: LOAN_DOCTYPE,
    groupBy: "parent",
    limit: 0,
  };
  const [all, paid] = await Promise.all([
    getList<RawScheduleAggregate>(LOAN_SCHEDULE_DOCTYPE, {
      ...common,
      fields: ["parent", "count(name) as row_count", "sum(total_payment) as scheduled"],
    }),
    getList<RawSchedulePaidAggregate>(LOAN_SCHEDULE_DOCTYPE, {
      ...common,
      filters: [...common.filters, ["is_paid", "=", 1]],
      fields: ["parent", "sum(total_payment) as paid_amount"],
    }),
  ]);
  const paidByLoan = new Map(paid.map((r) => [r.parent, toNumber(r.paid_amount)]));
  return new Map(
    all.map((r) => [
      r.parent,
      {
        rows: toNumber(r.row_count),
        scheduled: toNumber(r.scheduled),
        paid: paidByLoan.get(r.parent) ?? 0,
      },
    ]),
  );
}

const fmt = (v: number) => v.toLocaleString("en-US");

/**
 * Compares the report's row (header fields + its installment counts) with the
 * loan's own schedule. Only reports differences; never alters the figures.
 */
function integrityOf(
  row: LoanRecord,
  agg: { rows: number; scheduled: number; paid: number } | undefined,
): LoanIntegrity {
  if (!agg) {
    return {
      scheduleRows: 0,
      scheduledTotal: 0,
      schedulePaidTotal: 0,
      issues: ["No repayment schedule rows exist for this loan."],
    };
  }
  const issues: string[] = [];
  if (agg.rows !== row.repaymentPeriods) {
    issues.push(
      `Repayment periods is ${row.repaymentPeriods} but the schedule has ${agg.rows} installments.`,
    );
  }
  if (Math.abs(agg.scheduled - row.loanAmount) > 0.5) {
    issues.push(
      `Schedule installments add up to ${fmt(agg.scheduled)}, not the loan amount ${fmt(row.loanAmount)}.`,
    );
  }
  if (Math.abs(agg.paid - row.totalAmountPaid) > 0.5) {
    issues.push(
      `Installments marked paid add up to ${fmt(agg.paid)}, but Amount Paid on the loan is ${fmt(row.totalAmountPaid)}.`,
    );
  }
  if (Math.abs(row.loanAmount - row.totalAmountPaid - row.balanceAmount) > 0.5) {
    issues.push(
      `Loan amount − amount paid (${fmt(row.loanAmount - row.totalAmountPaid)}) differs from the balance ${fmt(row.balanceAmount)}.`,
    );
  }
  return {
    scheduleRows: agg.rows,
    scheduledTotal: agg.scheduled,
    schedulePaidTotal: agg.paid,
    issues,
  };
}

export async function fetchLoanReport(): Promise<LoanReport> {
  const [report, aggregates] = await Promise.all([
    runReport(),
    optional("HR Loan Repayment Schedule aggregates", fetchScheduleAggregates(), null),
  ]);

  const rawRows = (report?.result ?? []).filter(isObjectRow);

  // Guard against the same loan appearing twice — the report has no total
  // row, so every row must be a distinct HR Loan.
  const seen = new Set<string>();
  const records: LoanRecord[] = [];
  for (const raw of rawRows) {
    const loan = (raw.loan ?? "").trim();
    if (!loan || seen.has(loan)) {
      console.warn("[frappe] HR Loan Summary returned a blank or duplicate loan row", raw);
      continue;
    }
    seen.add(loan);
    records.push({
      loan,
      employee: (raw.employee ?? "").trim(),
      employeeName: raw.employee_name?.trim() || (raw.employee ?? "").trim(),
      department: raw.department?.trim() || "",
      loanType: raw.loan_type?.trim() || "",
      loanSource: raw.loan_source?.trim() || "",
      disbursementDate: raw.disbursement_date || null,
      loanAmount: toNumber(raw.loan_amount),
      monthlyInstallmentAmount: toNumber(raw.monthly_installment_amount),
      repaymentPeriods: toNumber(raw.repayment_periods),
      paidInstallments: toNumber(raw.paid_installments),
      pendingInstallments: toNumber(raw.pending_installments),
      totalAmountPaid: toNumber(raw.total_amount_paid),
      balanceAmount: toNumber(raw.balance_amount),
      status: raw.status?.trim() || "",
      employeeStatus: null,
      checks: null,
    });
  }

  const statuses = await optional(
    "Employee statuses for borrowers",
    fetchEmployeeStatuses([...new Set(records.map((r) => r.employee).filter(Boolean))]),
    null,
  );

  for (const r of records) {
    if (statuses) r.employeeStatus = statuses.get(r.employee) ?? null;
    if (aggregates) r.checks = integrityOf(r, aggregates.get(r.loan));
  }

  return {
    records,
    summary: report?.report_summary ?? null,
    chart: mapChart(report?.chart ?? null),
    executionTime: report?.execution_time ?? null,
    joins: { employeeStatus: statuses !== null, schedule: aggregates !== null },
  };
}

// ── One loan, with its schedule ────────────────────────────────────────────

export async function fetchLoanDetail(name: string): Promise<LoanDetail> {
  const doc = await getDoc<RawLoanDoc>(LOAN_DOCTYPE, name);
  const schedule: LoanScheduleRow[] = (doc.repayment_schedule ?? []).map((s) => ({
    idx: toNumber(s.idx),
    paymentDate: s.payment_date,
    principalAmount: toNumber(s.principal_amount),
    interestAmount: toNumber(s.interest_amount),
    totalPayment: toNumber(s.total_payment),
    balanceAfterPayment: toNumber(s.balance_loan_amount),
    isPaid: Boolean(Number(s.is_paid)),
    paidOn: s.paid_on || null,
    salarySlip: s.salary_slip || null,
  }));
  return {
    name: doc.name,
    employee: doc.employee,
    employeeName: doc.employee_name?.trim() || doc.employee,
    company: doc.company,
    loanApplication: doc.loan_application || null,
    loanType: doc.loan_type,
    loanSource: doc.loan_source ?? "",
    loanAmount: toNumber(doc.loan_amount),
    monthlyInstallmentAmount: toNumber(doc.monthly_installment_amount),
    repaymentPeriods: toNumber(doc.repayment_periods),
    rateOfInterest: toNumber(doc.rate_of_interest),
    monthlyRepaymentAmount: toNumber(doc.monthly_repayment_amount),
    totalInterestPayable: toNumber(doc.total_interest_payable),
    totalPayableAmount: toNumber(doc.total_payable_amount),
    totalAmountPaid: toNumber(doc.total_amount_paid),
    balanceAmount: toNumber(doc.balance_amount),
    disbursementDate: doc.disbursement_date || null,
    status: doc.status,
    loanAccount: doc.loan_account || null,
    paymentAccount: doc.payment_account || null,
    disbursementJournalEntry: doc.disbursement_journal_entry || null,
    created: doc.creation,
    modified: doc.modified,
    schedule,
  };
}
