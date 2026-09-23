import { useEffect, useState } from "react";
import type { LoanDetail, LoanRecord } from "../../data/loanData";
import { fetchLoanDetail } from "../../api/loanApi";
import { fmtDate, fmtInt, fmtRs, statusPillClass } from "./loanFormat";

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="ln-fact-label">{label}</div>
      <div className={`ln-fact-value${mono ? " mono" : ""}`}>{value}</div>
    </div>
  );
}

/**
 * The full `HR Loan` document and its repayment schedule, read fresh from
 * Frappe when opened. The summary row from the report is shown while it
 * loads so the drawer is never blank.
 */
export function LoanDetailDrawer({ record, onClose }: { record: LoanRecord; onClose: () => void }) {
  // Keyed by loan id so a stale document is never shown for a newly opened
  // loan — anything loaded for a different id reads as "not loaded yet".
  const [loaded, setLoaded] = useState<{ loan: string; detail: LoanDetail | null; error: string | null } | null>(null);
  const detail = loaded?.loan === record.loan ? loaded.detail : null;
  const error = loaded?.loan === record.loan ? loaded.error : null;

  useEffect(() => {
    let cancelled = false;
    fetchLoanDetail(record.loan)
      .then((d) => {
        if (!cancelled) setLoaded({ loan: record.loan, detail: d, error: null });
      })
      .catch((err) => {
        if (!cancelled) {
          setLoaded({ loan: record.loan, detail: null, error: err instanceof Error ? err.message : "Failed to load" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [record.loan]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const paidRows = detail?.schedule.filter((s) => s.isPaid).length ?? null;
  const issues = record.checks?.issues ?? [];

  return (
    <>
      <div className="ln-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="ln-drawer" role="dialog" aria-modal="true" aria-label={`Loan ${record.loan}`}>
        <div className="ln-drawer-head">
          <div>
            <h2>{record.loan}</h2>
            <p className="chart-sub">
              {record.employeeName} · {record.employee}
              {record.employeeStatus && record.employeeStatus !== "Active" ? ` · ${record.employeeStatus}` : ""}
            </p>
          </div>
          <button type="button" className="ln-drawer-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="ln-drawer-body">
          <div className="ln-facts">
            <Fact label="Status" value={detail?.status ?? record.status} />
            <Fact label="Loan type" value={detail?.loanType ?? record.loanType} />
            <Fact label="Repayment source" value={detail?.loanSource ?? record.loanSource} />
            <Fact label="Loan amount" value={fmtRs(detail?.loanAmount ?? record.loanAmount)} mono />
            <Fact label="Amount paid" value={fmtRs(detail?.totalAmountPaid ?? record.totalAmountPaid)} mono />
            <Fact label="Balance" value={fmtRs(detail?.balanceAmount ?? record.balanceAmount)} mono />
            <Fact
              label="Monthly installment"
              value={fmtRs(detail?.monthlyInstallmentAmount ?? record.monthlyInstallmentAmount)}
              mono
            />
            <Fact label="Repayment periods" value={fmtInt(detail?.repaymentPeriods ?? record.repaymentPeriods)} mono />
            <Fact label="Disbursed on" value={fmtDate(detail?.disbursementDate ?? record.disbursementDate)} mono />
            {detail && (
              <>
                <Fact label="Rate of interest" value={`${detail.rateOfInterest}%`} mono />
                <Fact label="Total interest payable" value={fmtRs(detail.totalInterestPayable)} mono />
                <Fact label="Total payable" value={fmtRs(detail.totalPayableAmount)} mono />
                <Fact label="Monthly repayment (EMI)" value={fmtRs(detail.monthlyRepaymentAmount)} mono />
                <Fact label="Loan application" value={detail.loanApplication ?? "—"} mono />
                <Fact label="Disbursement journal entry" value={detail.disbursementJournalEntry ?? "—"} mono />
                <Fact label="Loan account" value={detail.loanAccount ?? "—"} />
                <Fact label="Disbursement account" value={detail.paymentAccount ?? "—"} />
                <Fact label="Company" value={detail.company} />
                <Fact label="Created" value={fmtDate(detail.created)} mono />
                <Fact label="Last modified" value={fmtDate(detail.modified)} mono />
              </>
            )}
          </div>

          {issues.length > 0 && (
            <div className="ln-card ln-checks" style={{ marginBottom: 18 }}>
              <div className="chart-title">Schedule does not reconcile with the loan</div>
              <ul>
                {issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="chart-card-head">
            <div>
              <div className="chart-title">Repayment schedule</div>
              {detail && (
                <p className="ln-sched-summary">
                  <span>
                    <b>{fmtInt(detail.schedule.length)}</b> installments
                  </span>
                  <span>
                    <b>{fmtInt(paidRows ?? 0)}</b> paid
                  </span>
                  <span>
                    <b>{fmtInt(detail.schedule.length - (paidRows ?? 0))}</b> pending
                  </span>
                </p>
              )}
            </div>
            <span className={`status-pill ${statusPillClass(detail?.status ?? record.status)}`}>
              <span className="dot" />
              {detail?.status ?? record.status}
            </span>
          </div>

          {error ? (
            <div className="ln-card ln-error">
              <div className="chart-title">Could not load this loan</div>
              <p className="chart-sub" style={{ marginTop: 6 }}>
                {error}
              </p>
            </div>
          ) : !detail ? (
            <p className="chart-sub">Loading the HR Loan document…</p>
          ) : detail.schedule.length === 0 ? (
            <p className="chart-sub">This loan has no repayment schedule rows.</p>
          ) : (
            <div className="ln-table-wrap">
              <table className="data-table ln-sched">
                <thead>
                  <tr>
                    <th className="num">#</th>
                    <th>Payment date</th>
                    <th className="num">Principal</th>
                    <th className="num">Interest</th>
                    <th className="num">Total (EMI)</th>
                    <th className="num">Balance after</th>
                    <th>Paid</th>
                    <th>Paid on</th>
                    <th>Salary slip</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.schedule.map((s) => (
                    <tr key={s.idx} className={s.isPaid ? "paid" : undefined}>
                      <td className="num cell-mono">{s.idx}</td>
                      <td className="cell-mono">{fmtDate(s.paymentDate)}</td>
                      <td className="num cell-mono">{fmtRs(s.principalAmount)}</td>
                      <td className="num cell-mono">{fmtRs(s.interestAmount)}</td>
                      <td className="num cell-mono">{fmtRs(s.totalPayment)}</td>
                      <td className="num cell-mono">{fmtRs(s.balanceAfterPayment)}</td>
                      <td>
                        <span className={`status-pill ${s.isPaid ? "done" : "pending"}`}>
                          <span className="dot" />
                          {s.isPaid ? "Paid" : "Pending"}
                        </span>
                      </td>
                      <td className="cell-mono">{fmtDate(s.paidOn)}</td>
                      <td className="cell-mono">{s.salarySlip ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
