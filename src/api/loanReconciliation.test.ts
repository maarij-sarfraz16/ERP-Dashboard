// Reconciliation: the Loans page vs. the ATS desk's "HR Loan Summary" report
// and the `HR Loan` table, against the LIVE site in `.env`.
//
//   npm test
//
// The desk side is obtained the way the desk obtains it — the script report
// run through `frappe.desk.query_report.run`, and the raw doctype through
// `frappe.client.get_list` — never through this app's adapter. It fails on
// ANY difference: the set of loan ids, every per-row field, the five summary
// cards and the chart, not just the headline totals.

import { describe, expect, it } from "vitest";
import { callMethod, getList } from "./frappeClient";
import { fetchLoanReport, LOAN_REPORT_NAME } from "./loanApi";
import type { LoanRecord, LoanReport } from "../data/loanData";

interface DeskRow {
  loan: string;
  employee: string;
  employee_name: string;
  department: string;
  loan_type: string;
  loan_source: string;
  disbursement_date: string | null;
  loan_amount: number;
  monthly_installment_amount: number;
  repayment_periods: number;
  total_amount_paid: number;
  balance_amount: number;
  status: string;
  paid_installments: number;
  pending_installments: number;
}

interface DeskReport {
  result: DeskRow[];
  report_summary: { label: string; value: number }[] | null;
  chart: { data: { labels: string[]; datasets: { values: number[] }[] } } | null;
}

interface RawLoan {
  name: string;
  employee: string;
  status: string;
  loan_amount: number;
  total_amount_paid: number;
  balance_amount: number;
}

function desk(filters: Record<string, string> = {}): Promise<DeskReport> {
  return callMethod<DeskReport>(
    "frappe.desk.query_report.run",
    { report_name: LOAN_REPORT_NAME, filters, ignore_prepared_report: 1 },
    { timeoutMs: 90_000 },
  );
}

const sum = <T>(rows: T[], pick: (r: T) => number) => rows.reduce((s, r) => s + pick(r), 0);
const card = (r: DeskReport, label: string) =>
  r.report_summary?.find((c) => c.label === label)?.value;

let cachedPage: Promise<LoanReport> | undefined;
let cachedDesk: Promise<DeskReport> | undefined;
const page = () => (cachedPage ??= fetchLoanReport());
const deskAll = () => (cachedDesk ??= desk());

describe("Loans page vs. HR Loan Summary report", () => {
  it("returns exactly the report's loan ids, no more, no fewer, none twice", async () => {
    const [ours, theirs] = await Promise.all([page(), deskAll()]);
    const ourIds = ours.records.map((r) => r.loan);
    const theirIds = theirs.result.map((r) => r.loan);
    expect(new Set(ourIds).size).toBe(ourIds.length);
    expect(new Set(theirIds).size).toBe(theirIds.length);
    expect([...ourIds].sort()).toEqual([...theirIds].sort());
    expect(ours.records.length).toBeGreaterThan(0);
  });

  it("carries every field of every row through unchanged", async () => {
    const [ours, theirs] = await Promise.all([page(), deskAll()]);
    const byId = new Map(ours.records.map((r) => [r.loan, r]));
    for (const d of theirs.result) {
      const o = byId.get(d.loan) as LoanRecord;
      expect(o, d.loan).toBeDefined();
      expect(o.employee).toBe(d.employee);
      // Text fields are trimmed on the way in (one name carries a trailing
      // space in the source); everything else must be byte-identical.
      expect(o.employeeName).toBe(d.employee_name.trim());
      expect(o.department).toBe(d.department.trim());
      expect(o.loanType).toBe(d.loan_type.trim());
      expect(o.loanSource).toBe(d.loan_source.trim());
      expect(o.disbursementDate).toBe(d.disbursement_date);
      expect(o.loanAmount).toBe(d.loan_amount);
      expect(o.monthlyInstallmentAmount).toBe(d.monthly_installment_amount);
      expect(o.repaymentPeriods).toBe(d.repayment_periods);
      expect(o.paidInstallments).toBe(d.paid_installments);
      expect(o.pendingInstallments).toBe(d.pending_installments);
      expect(o.totalAmountPaid).toBe(d.total_amount_paid);
      expect(o.balanceAmount).toBe(d.balance_amount);
      expect(o.status).toBe(d.status);
    }
  });

  it("shows the report's own summary cards and chart verbatim", async () => {
    const [ours, theirs] = await Promise.all([page(), deskAll()]);
    expect(ours.summary).toEqual(theirs.report_summary);
    expect(ours.chart?.points.map((p) => p.label)).toEqual(theirs.chart?.data.labels);
    expect(ours.chart?.points.map((p) => p.value)).toEqual(theirs.chart?.data.datasets[0].values);
  });

  it("summary cards equal the sums/counts over the rows (so filtered totals are safe)", async () => {
    // The page filters in the browser and totals the visible rows; that is
    // only honest if the server's cards are themselves plain sums/counts of
    // its rows. Prove it for the whole set and for a few server-side filters.
    const filterSets: Record<string, string>[] = [{}, { status: "Disbursed" }, { status: "Closed" }];
    const all = await deskAll();
    const depts = [...new Set(all.result.map((r) => r.department))].slice(0, 3);
    for (const d of depts) filterSets.push({ department: d });
    const sources = [...new Set(all.result.map((r) => r.loan_source))];
    for (const s of sources) filterSets.push({ loan_source: s });

    for (const filters of filterSets) {
      const r = Object.keys(filters).length ? await desk(filters) : all;
      const rows = r.result;
      if (rows.length === 0) {
        expect(r.report_summary, JSON.stringify(filters)).toBeNull();
        continue;
      }
      const label = JSON.stringify(filters);
      expect(card(r, "Active Loans"), label).toBe(rows.filter((x) => x.status === "Disbursed").length);
      expect(card(r, "Closed Loans"), label).toBe(rows.filter((x) => x.status === "Closed").length);
      expect(card(r, "Total Loan Amount"), label).toBe(sum(rows, (x) => x.loan_amount));
      expect(card(r, "Total Amount Recovered"), label).toBe(sum(rows, (x) => x.total_amount_paid));
      expect(card(r, "Total Outstanding Balance"), label).toBe(sum(rows, (x) => x.balance_amount));
    }
  });

  it("matches the raw HR Loan table: ids, statuses and amounts", async () => {
    const [ours, raw] = await Promise.all([
      page(),
      getList<RawLoan>("HR Loan", {
        fields: ["name", "employee", "status", "loan_amount", "total_amount_paid", "balance_amount"],
        limit: 0,
      }),
    ]);
    expect(ours.records.map((r) => r.loan).sort()).toEqual(raw.map((r) => r.name).sort());
    const byId = new Map(raw.map((r) => [r.name, r]));
    for (const o of ours.records) {
      const r = byId.get(o.loan)!;
      expect(o.employee).toBe(r.employee);
      expect(o.status).toBe(r.status);
      expect(o.loanAmount).toBe(r.loan_amount);
      expect(o.totalAmountPaid).toBe(r.total_amount_paid);
      expect(o.balanceAmount).toBe(r.balance_amount);
    }
  });

  it("joins an Employee status and a schedule cross-check onto every row", async () => {
    const ours = await page();
    expect(ours.joins).toEqual({ employeeStatus: true, schedule: true });
    for (const r of ours.records) {
      expect(r.employeeStatus, r.loan).toBeTruthy();
      expect(r.checks, r.loan).not.toBeNull();
    }
    // Report the source-data inconsistencies, so a run makes them visible.
    const flagged = ours.records.filter((r) => r.checks && r.checks.issues.length > 0);
    console.info(
      `[loans] ${flagged.length} of ${ours.records.length} loans have a schedule that does not reconcile with the loan header:\n` +
        flagged.map((r) => `  ${r.loan}: ${r.checks!.issues.join(" | ")}`).join("\n"),
    );
  });
});
