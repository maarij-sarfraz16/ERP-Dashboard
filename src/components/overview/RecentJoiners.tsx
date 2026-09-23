import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { Employee } from "../../data/employeeData";
import { compareEmployeeId } from "../../api/frappeMappers";
import { CYCLE_META } from "../payroll/payrollFormat";

const SHOWN = 6;

function joined(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

function daysSince(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const then = new Date(y, m - 1, d).getTime();
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}

/** The most recently joined active employees, listed by employee id. */
export function RecentJoiners({ employees }: { employees: Employee[] }) {
  const rows = useMemo(
    () =>
      employees
        .filter((e) => e.status === "active" && e.joinDate)
        .sort((a, b) => b.joinDate.localeCompare(a.joinDate))
        .slice(0, SHOWN)
        .sort((a, b) => compareEmployeeId(a.id, b.id)),
    [employees],
  );

  return (
    <div className="card chart-card load-in load-in-4">
      <div className="chart-card-head">
        <div>
          <div className="chart-title">Recent joiners</div>
          <div className="chart-sub">Newest active employees by date of joining</div>
        </div>
        <Link className="mini-chart-link" to="/employees">
          Directory →
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="chart-sub">No joining dates on file.</p>
      ) : (
        <ul className="ov-joiners">
          {rows.map((e) => {
            const age = daysSince(e.joinDate);
            return (
              <li className="ov-joiner" key={e.id}>
                <span className="ov-joiner-avatar" style={{ background: CYCLE_META[e.employmentType].color }}>
                  {e.photoUrl ? <img src={e.photoUrl} alt="" loading="lazy" /> : e.initials}
                </span>
                <span className="ov-joiner-body">
                  <span className="ov-joiner-name">{e.name}</span>
                  <span className="ov-joiner-role">
                    <span className="mono">{e.id}</span> · {e.role} · {e.department}
                  </span>
                </span>
                <span className="ov-joiner-when">
                  <span className="mono">{joined(e.joinDate)}</span>
                  <span className="ov-joiner-age">{age === 0 ? "today" : age === 1 ? "1 day ago" : `${age} days ago`}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
