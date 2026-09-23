import type { PayrollRun } from "../../data/mockData";
import { PayrollRunBadge } from "../common/StatusBadge";
import { CYCLE_META, formatRs } from "./payrollFormat";

export function PayrollRunsTable({ rows }: { rows: PayrollRun[] }) {
  if (rows.length === 0) {
    return <p className="chart-sub py-empty">No payroll runs for this cycle.</p>;
  }

  const max = Math.max(...rows.map((r) => r.totalAmount));

  return (
    <div className="py-table-wrap">
      <table className="data-table py-table">
        <thead>
          <tr>
            <th>Period</th>
            <th>Cycle</th>
            <th>Run date</th>
            <th className="num">Employees paid</th>
            <th className="num">Total amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((run) => {
            const meta = CYCLE_META[run.cycle];
            return (
              <tr key={run.id}>
                <td className="py-period">{run.period}</td>
                <td>
                  <span className="py-cycle">
                    <span className="py-cycle-dot" style={{ background: meta.color }} />
                    {meta.label}
                  </span>
                </td>
                <td className="cell-mono">{run.runDate}</td>
                <td className="cell-mono num">{run.employeesPaid.toLocaleString("en-PK")}</td>
                <td className="cell-mono num">
                  <div className="py-amount">
                    <span>{formatRs(run.totalAmount)}</span>
                    <span className="py-amount-track" aria-hidden="true">
                      <span
                        className="py-amount-fill"
                        style={{
                          width: `${max ? (run.totalAmount / max) * 100 : 0}%`,
                          background: meta.color,
                        }}
                      />
                    </span>
                  </div>
                </td>
                <td>
                  <PayrollRunBadge status={run.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
