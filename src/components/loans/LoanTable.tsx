import type { LoanRecord } from "../../data/loanData";
import { cleanDepartment } from "../../api/frappeMappers";
import { fmtDate, fmtInt, fmtRs, statusPillClass } from "./loanFormat";
import { COLUMNS, type SortKey, type SortState, type VisibleTotals } from "./loanTableModel";

export function LoanTable({
  rows,
  offset,
  sort,
  onSort,
  onOpen,
  footer,
  footerLabel,
}: {
  /** The rows of the current page. */
  rows: LoanRecord[];
  /** Row number of the first row on this page (0-based). */
  offset: number;
  sort: SortState | null;
  onSort: (key: SortKey, numeric: boolean) => void;
  onOpen: (loan: string) => void;
  /** Totals over every row that matches the filters (not just this page). */
  footer: VisibleTotals;
  footerLabel: string;
}) {
  return (
    <div className="ln-table-wrap">
      <table className="data-table ln-table">
        <thead>
          <tr>
            <th className="num">#</th>
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                className={c.numeric ? "num" : undefined}
                aria-sort={sort?.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
              >
                <button type="button" onClick={() => onSort(c.key, c.numeric)}>
                  {c.label}
                  <span className="ln-sort">{sort?.key === c.key ? (sort.dir === 1 ? "▲" : "▼") : ""}</span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const issues = r.checks?.issues ?? [];
            const offRoll = r.employeeStatus !== null && r.employeeStatus !== "Active";
            return (
              <tr
                key={r.loan}
                onClick={() => onOpen(r.loan)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpen(r.loan);
                  }
                }}
                aria-label={`Open ${r.loan}`}
              >
                <td className="num muted cell-mono">{offset + i + 1}</td>
                <td className="mono cell-mono">
                  {r.loan}
                  {issues.length > 0 && (
                    <span className="ln-flag" title={issues.join("\n")} aria-label="Schedule does not reconcile">
                      !
                    </span>
                  )}
                </td>
                <td className="mono cell-mono">{r.employee}</td>
                <td className="name">
                  {r.employeeName}
                  {r.employeeStatus !== null && (
                    <span className={`ln-emp-status${offRoll ? " off" : ""}`} title="Employee status">
                      {r.employeeStatus}
                    </span>
                  )}
                </td>
                <td title={r.department}>{cleanDepartment(r.department)}</td>
                <td>{r.loanSource || "—"}</td>
                <td className="mono cell-mono">{fmtDate(r.disbursementDate)}</td>
                <td className="num cell-mono">{fmtRs(r.loanAmount)}</td>
                <td className="num cell-mono">{fmtRs(r.monthlyInstallmentAmount)}</td>
                <td className="num cell-mono">{fmtInt(r.repaymentPeriods)}</td>
                <td className="num cell-mono">{fmtInt(r.paidInstallments)}</td>
                <td className="num cell-mono">{fmtInt(r.pendingInstallments)}</td>
                <td className="num cell-mono">{fmtRs(r.totalAmountPaid)}</td>
                <td className="num cell-mono">{fmtRs(r.balanceAmount)}</td>
                <td>
                  <span className={`status-pill ${statusPillClass(r.status)}`}>
                    <span className="dot" />
                    {r.status || "—"}
                  </span>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length + 1} className="ln-empty">
                No loans match these filters.
              </td>
            </tr>
          )}
        </tbody>
        {footer.count > 0 && (
          <tfoot>
            <tr>
              <td />
              <td colSpan={6}>
                {footerLabel} · {fmtInt(footer.count)} loans
              </td>
              <td className="num">{fmtRs(footer.loanAmount)}</td>
              <td />
              <td className="num">{fmtInt(footer.repaymentPeriods)}</td>
              <td className="num">{fmtInt(footer.paidInstallments)}</td>
              <td className="num">{fmtInt(footer.pendingInstallments)}</td>
              <td className="num">{fmtRs(footer.totalAmountPaid)}</td>
              <td className="num">{fmtRs(footer.balanceAmount)}</td>
              <td />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
