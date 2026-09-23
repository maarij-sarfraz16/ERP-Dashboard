import type { CheckIn } from "../../data/mockData";
import { AttendanceStatusBadge } from "../common/StatusBadge";

export function CheckInTable({ rows }: { rows: CheckIn[] }) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Employee</th>
          <th>Department</th>
          <th>Shift</th>
          <th>Check-in</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const rowClass =
            row.status === "absent" ? "row-flag" : row.status === "late" ? "row-warn" : "";
          return (
            <tr key={row.id} className={rowClass}>
              <td>{row.employeeName}</td>
              <td>{row.department}</td>
              <td className="cell-mono">{row.shift}</td>
              <td className="cell-mono">
                {row.checkIn}
                {row.status === "late" && (
                  <span style={{ color: "var(--status-late)", marginLeft: 6 }}>
                    +{row.minutesLate}m
                  </span>
                )}
              </td>
              <td>
                <AttendanceStatusBadge status={row.status} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
