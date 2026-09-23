import { useEffect, useState } from "react";
import type { ExpenseClaimDetail, ExpenseClaimRecord } from "../../data/expenseClaimData";
import { fetchExpenseClaimDetail } from "../../api/expenseClaimApi";
import { cleanDepartment } from "../../api/frappeMappers";
import {
  BENEFICIARY_COLOR,
  fmtDate,
  fmtInt,
  fmtRs,
  statusPillClass,
  titleCase,
  workflowLabel,
  workflowPillClass,
} from "./expenseFormat";

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="ln-fact-label">{label}</div>
      <div className={`ln-fact-value${mono ? " mono" : ""}`}>{value}</div>
    </div>
  );
}

/** The bill columns are free text on this site; show whichever are filled. */
function billsOf(l: ExpenseClaimDetail["expenses"][number]): { label: string; value: string }[] {
  return [
    { label: "Doctor / hospital", value: l.doctorHospital },
    { label: "Medicine", value: l.medicineBill },
    { label: "Lab test", value: l.labTest },
    { label: "Emergency", value: l.emergencyBill },
  ].filter((b) => b.value);
}

/**
 * The full `Expense Claim` document and its expense lines, read fresh from
 * Frappe when opened. The header row from the list is shown while it loads
 * so the drawer is never blank.
 */
export function ExpenseClaimDrawer({ record, onClose }: { record: ExpenseClaimRecord; onClose: () => void }) {
  // Keyed by claim id so a stale document is never shown for a newly opened
  // claim — anything loaded for a different id reads as "not loaded yet".
  const [loaded, setLoaded] = useState<{ name: string; detail: ExpenseClaimDetail | null; error: string | null } | null>(
    null,
  );
  const detail = loaded?.name === record.name ? loaded.detail : null;
  const error = loaded?.name === record.name ? loaded.error : null;

  useEffect(() => {
    let cancelled = false;
    fetchExpenseClaimDetail(record.name)
      .then((d) => {
        if (!cancelled) setLoaded({ name: record.name, detail: d, error: null });
      })
      .catch((err) => {
        if (!cancelled) {
          setLoaded({ name: record.name, detail: null, error: err instanceof Error ? err.message : "Failed to load" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [record.name]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const h = detail ?? record;
  const entitlementUsed = h.medicalAmount > 0 ? Math.min(100, ((h.medicalAmount - h.remainingBalance) / h.medicalAmount) * 100) : 0;
  const lineTotal = detail?.expenses.reduce((s, l) => s + l.amount, 0) ?? 0;
  const lineSanctioned = detail?.expenses.reduce((s, l) => s + l.sanctionedAmount, 0) ?? 0;

  return (
    <>
      <div className="ln-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="ln-drawer" role="dialog" aria-modal="true" aria-label={`Expense claim ${record.name}`}>
        <div className="ln-drawer-head">
          <div>
            <h2>{record.name}</h2>
            <p className="chart-sub">
              {record.employeeName} · {record.employee} · {cleanDepartment(record.department)}
              {record.employeeStatus && record.employeeStatus !== "Active" ? ` · ${record.employeeStatus}` : ""}
            </p>
          </div>
          <div className="ec-drawer-pills">
            <span className={`status-pill ${workflowPillClass(h.workflowState)}`}>
              <span className="dot" />
              {workflowLabel(h.workflowState)}
            </span>
            <span className={`status-pill ${statusPillClass(h.status)}`}>
              <span className="dot" />
              {h.status}
            </span>
            <button type="button" className="ln-drawer-close" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
        </div>

        <div className="ln-drawer-body">
          <div className="ec-drawer-hero">
            <div>
              <div className="ln-fact-label">Claimed</div>
              <div className="ec-hero-value">{fmtRs(h.totalClaimedAmount)}</div>
            </div>
            <div>
              <div className="ln-fact-label">Sanctioned</div>
              <div className="ec-hero-value" style={{ color: "var(--data-green)" }}>
                {fmtRs(h.totalSanctionedAmount)}
              </div>
            </div>
            <div>
              <div className="ln-fact-label">Reimbursed</div>
              <div className="ec-hero-value" style={{ color: h.totalAmountReimbursed > 0 ? "var(--data-indigo)" : undefined }}>
                {fmtRs(h.totalAmountReimbursed)}
              </div>
            </div>
          </div>

          {h.medicalAmount > 0 && (
            <div className="ec-entitlement">
              <div className="ec-entitlement-head">
                <span>Medical entitlement</span>
                <span className="mono">
                  {fmtRs(h.remainingBalance)} left of {fmtRs(h.medicalAmount)}
                </span>
              </div>
              <div className="ln-meter" role="img" aria-label={`${entitlementUsed.toFixed(0)}% of entitlement used`}>
                <span style={{ width: `${entitlementUsed}%`, background: "var(--data-indigo)" }} />
                <span style={{ width: `${100 - entitlementUsed}%`, background: "transparent" }} />
              </div>
            </div>
          )}

          <div className="ln-facts">
            <Fact label="Expense type" value={h.expenseType ? titleCase(h.expenseType) : "—"} />
            <Fact label="Bill of month" value={h.billOfMonth || "—"} />
            <Fact label="Posting date" value={fmtDate(h.postingDate)} mono />
            <Fact label="Designation" value={h.designation ? titleCase(h.designation) : "—"} />
            <Fact label="Marital status" value={h.maritalStatus || "—"} />
            <Fact label="Salary" value={h.salary > 0 ? fmtRs(h.salary) : "—"} mono />
            <Fact label="Approval status" value={h.approvalStatus || "—"} />
            <Fact label="Expense approver" value={h.expenseApprover || "—"} mono />
            <Fact label="Document" value={h.docstatus === 1 ? "Submitted" : h.docstatus === 2 ? "Cancelled" : "Draft"} />
            <Fact label="Paid" value={h.isPaid ? `Yes${h.modeOfPayment ? ` · ${h.modeOfPayment}` : ""}` : "No"} />
            <Fact label="Clearance date" value={fmtDate(h.clearanceDate)} mono />
            <Fact label="Grand total" value={fmtRs(h.grandTotal)} mono />
            {(h.totalAdvanceAmount > 0 || h.totalTaxesAndCharges > 0) && (
              <>
                <Fact label="Advances applied" value={fmtRs(h.totalAdvanceAmount)} mono />
                <Fact label="Taxes and charges" value={fmtRs(h.totalTaxesAndCharges)} mono />
              </>
            )}
            <Fact label="Payable account" value={h.payableAccount ?? "—"} />
            <Fact label="Cost center" value={h.costCenter ?? "—"} />
            {h.project && <Fact label="Project" value={h.project} />}
            {detail?.amendedFrom && <Fact label="Amended from" value={detail.amendedFrom} mono />}
            <Fact label="Created by" value={h.owner} mono />
            <Fact label="Created" value={fmtDate(h.created)} mono />
            <Fact label="Last modified" value={`${fmtDate(h.modified)} · ${h.modifiedBy}`} mono />
            {h.remark && <Fact label="Remark" value={h.remark} />}
          </div>

          <div className="chart-card-head">
            <div>
              <div className="chart-title">Expense lines</div>
              {detail && (
                <p className="ln-sched-summary">
                  <span>
                    <b>{fmtInt(detail.expenses.length)}</b> lines
                  </span>
                  <span>
                    <b>{fmtRs(lineTotal)}</b> claimed
                  </span>
                  <span>
                    <b>{fmtRs(lineSanctioned)}</b> sanctioned
                  </span>
                </p>
              )}
            </div>
          </div>

          {error ? (
            <div className="ln-card ln-error">
              <div className="chart-title">Could not load this claim</div>
              <p className="chart-sub" style={{ marginTop: 6 }}>
                {error}
              </p>
            </div>
          ) : !detail ? (
            <p className="chart-sub">Loading the Expense Claim document…</p>
          ) : detail.expenses.length === 0 ? (
            <p className="chart-sub">This claim has no expense lines.</p>
          ) : (
            <div className="ln-table-wrap">
              <table className="data-table ln-sched ec-lines">
                <thead>
                  <tr>
                    <th className="num">#</th>
                    <th>Expense date</th>
                    <th>For</th>
                    <th>Bills</th>
                    <th>Type</th>
                    <th className="num">Amount</th>
                    <th className="num">Sanctioned</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.expenses.map((l) => {
                    const bills = billsOf(l);
                    return (
                      <tr key={l.idx} className={l.sanctionedAmount < l.amount ? "ec-line-cut" : undefined}>
                        <td className="num cell-mono">{l.idx}</td>
                        <td className="cell-mono">{fmtDate(l.expenseDate)}</td>
                        <td>
                          <span className="ec-benef">
                            <span className="ln-key-dot" style={{ background: BENEFICIARY_COLOR[l.claimType] }} />
                            {l.claimType || "—"}
                          </span>
                        </td>
                        <td>
                          <div className="ec-bills">
                            {bills.length === 0
                              ? l.description || "—"
                              : bills.map((b) => (
                                  <span key={b.label}>
                                    <span className="ec-bill-label">{b.label}</span> {b.value}
                                  </span>
                                ))}
                          </div>
                        </td>
                        <td>{l.expenseType ? titleCase(l.expenseType) : "—"}</td>
                        <td className="num cell-mono">{fmtRs(l.amount)}</td>
                        <td className="num cell-mono">{fmtRs(l.sanctionedAmount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {detail && detail.advances.length > 0 && (
            <>
              <div className="chart-card-head" style={{ marginTop: 20 }}>
                <div className="chart-title">Advances</div>
              </div>
              <div className="ln-table-wrap">
                <table className="data-table ln-sched">
                  <thead>
                    <tr>
                      <th>Employee advance</th>
                      <th>Posting date</th>
                      <th className="num">Advance paid</th>
                      <th className="num">Unclaimed</th>
                      <th className="num">Allocated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.advances.map((a) => (
                      <tr key={a.employeeAdvance}>
                        <td className="cell-mono">{a.employeeAdvance}</td>
                        <td className="cell-mono">{fmtDate(a.postingDate)}</td>
                        <td className="num cell-mono">{fmtRs(a.advancePaid)}</td>
                        <td className="num cell-mono">{fmtRs(a.unclaimedAmount)}</td>
                        <td className="num cell-mono">{fmtRs(a.allocatedAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {detail && detail.taxes.length > 0 && (
            <>
              <div className="chart-card-head" style={{ marginTop: 20 }}>
                <div className="chart-title">Taxes and charges</div>
              </div>
              <div className="ln-table-wrap">
                <table className="data-table ln-sched">
                  <thead>
                    <tr>
                      <th>Account head</th>
                      <th className="num">Rate</th>
                      <th className="num">Amount</th>
                      <th className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.taxes.map((t, i) => (
                      <tr key={`${t.accountHead}-${i}`}>
                        <td>{t.accountHead}</td>
                        <td className="num cell-mono">{t.rate}%</td>
                        <td className="num cell-mono">{fmtRs(t.taxAmount)}</td>
                        <td className="num cell-mono">{fmtRs(t.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
