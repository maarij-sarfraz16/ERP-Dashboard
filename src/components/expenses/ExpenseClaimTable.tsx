import type { ExpenseClaimRecord } from "../../data/expenseClaimData";
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
import { COLUMNS, type SortKey, type SortState, type VisibleTotals } from "./expenseTableModel";

/** Tiny stacked bar: who the claim's lines were for, by amount. */
function SplitBar({ record }: { record: ExpenseClaimRecord }) {
  const split = record.split;
  if (!split || split.length === 0) return null;
  const total = split.reduce((s, p) => s + p.amount, 0);
  if (total <= 0) return null;
  const title = split
    .map((p) => `${p.beneficiary || "Unspecified"}: ${fmtRs(p.amount)} (${p.lines} line${p.lines === 1 ? "" : "s"})`)
    .join("\n");
  return (
    <span className="ec-split" title={title} aria-label={title}>
      {split.map((p) => (
        <span
          key={p.beneficiary || "none"}
          style={{ width: `${(p.amount / total) * 100}%`, background: BENEFICIARY_COLOR[p.beneficiary] }}
        />
      ))}
    </span>
  );
}

export function ExpenseClaimTable({
  rows,
  offset,
  sort,
  onSort,
  onOpen,
  footer,
  footerLabel,
}: {
  /** The rows of the current page. */
  rows: ExpenseClaimRecord[];
  /** Row number of the first row on this page (0-based). */
  offset: number;
  sort: SortState | null;
  onSort: (key: SortKey, numeric: boolean) => void;
  onOpen: (name: string) => void;
  /** Totals over every row that matches the filters (not just this page). */
  footer: VisibleTotals;
  footerLabel: string;
}) {
  return (
    <div className="ln-table-wrap">
      <table className="data-table ln-table ec-table">
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
            const offRoll = r.employeeStatus !== null && r.employeeStatus !== "Active";
            const partial = r.docstatus === 1 && r.totalSanctionedAmount < r.totalClaimedAmount;
            return (
              <tr
                key={r.name}
                className={r.docstatus === 2 ? "ec-cancelled" : undefined}
                onClick={() => onOpen(r.name)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpen(r.name);
                  }
                }}
                aria-label={`Open ${r.name}`}
              >
                <td className="num muted cell-mono">{offset + i + 1}</td>
                <td className="mono cell-mono">
                  {r.name}
                  {partial && (
                    <span
                      className="ln-flag"
                      title={`Sanctioned ${fmtRs(r.totalSanctionedAmount)} of ${fmtRs(r.totalClaimedAmount)} claimed`}
                      aria-label="Partially sanctioned"
                    >
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
                <td className="ec-designation">{r.designation ? titleCase(r.designation) : "—"}</td>
                <td>
                  <span className="ec-type">{r.expenseType ? titleCase(r.expenseType) : "—"}</span>
                  <SplitBar record={r} />
                </td>
                <td className="cell-mono">{r.billOfMonth || "—"}</td>
                <td className="mono cell-mono">{fmtDate(r.postingDate)}</td>
                <td className="num cell-mono">{fmtRs(r.totalClaimedAmount)}</td>
                <td className="num cell-mono">{fmtRs(r.totalSanctionedAmount)}</td>
                <td className="num cell-mono">{fmtRs(r.totalAmountReimbursed)}</td>
                <td className="num cell-mono">{fmtRs(r.medicalAmount)}</td>
                <td className="num cell-mono">{fmtRs(r.remainingBalance)}</td>
                <td>
                  <span className={`status-pill ${workflowPillClass(r.workflowState)}`}>
                    <span className="dot" />
                    {workflowLabel(r.workflowState)}
                  </span>
                </td>
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
                No expense claims match these filters.
              </td>
            </tr>
          )}
        </tbody>
        {footer.count > 0 && (
          <tfoot>
            <tr>
              <td />
              <td colSpan={8}>
                {footerLabel} · {fmtInt(footer.count)} claims · {fmtInt(footer.employees)} employees
              </td>
              <td className="num">{fmtRs(footer.totalClaimedAmount)}</td>
              <td className="num">{fmtRs(footer.totalSanctionedAmount)}</td>
              <td className="num">{fmtRs(footer.totalAmountReimbursed)}</td>
              <td className="num">{fmtRs(footer.medicalAmount)}</td>
              <td className="num">{fmtRs(footer.remainingBalance)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
