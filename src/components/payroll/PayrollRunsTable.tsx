import type { PayrollRun } from "../../data/mockData";
import { PayrollRunBadge } from "../common/StatusBadge";

function formatCurrency(v: number): string {
  return `Rs ${v.toLocaleString("en-PK")}`;
}

export function PayrollRunsTable({ rows }: { rows: PayrollRun[] }) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Run</th>
          <th>Period</th>
          <th>Run date</th>
          <th>Employees paid</th>
          <th>Total amount</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((run) => (
          <tr key={run.id}>
            <td className="cell-mono">{run.id}</td>
            <td>{run.period}</td>
            <td className="cell-mono">{run.runDate}</td>
            <td className="cell-mono">{run.employeesPaid}</td>
            <td className="cell-mono">{formatCurrency(run.totalAmount)}</td>
            <td>
              <PayrollRunBadge status={run.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
