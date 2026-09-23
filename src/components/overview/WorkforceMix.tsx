import { Link } from "react-router-dom";
import type { EmployeeApiResponse } from "../../data/employeeData";
import { CYCLE_META } from "../payroll/payrollFormat";

/**
 * Active headcount by employment type as one split bar, with the month-by-
 * month new-hire pulse beneath it. Both come from the roster the Employees
 * page already reads, so the numbers here always match that page.
 */
export function WorkforceMix({ data }: { data: EmployeeApiResponse }) {
  const split = data.employmentTypeSplit;
  const total = split.reduce((a, s) => a + s.count, 0);
  const hires = data.newHiresByMonth;
  const hireMax = Math.max(1, ...hires.map((h) => h.count));
  const hiresYear = hires.reduce((a, h) => a + h.count, 0);

  return (
    <div className="card chart-card load-in load-in-3">
      <div className="chart-card-head">
        <div>
          <div className="chart-title">Workforce mix</div>
          <div className="chart-sub">Active employees by type · new hires by month</div>
        </div>
        <Link className="mini-chart-link" to="/employees">
          View detail →
        </Link>
      </div>

      <div className="ov-meter-track tall">
        {split.map((s) => (
          <span
            key={s.type}
            className="ov-meter-fill"
            style={{ width: total ? `${(s.count / total) * 100}%` : 0, background: CYCLE_META[s.type].color }}
            title={`${CYCLE_META[s.type].label}: ${s.count}`}
          />
        ))}
      </div>
      <div className="ov-mix-legend">
        {split.map((s) => (
          <div className="ov-mix-item" key={s.type}>
            <span className="legend-swatch" style={{ background: CYCLE_META[s.type].color }} />
            <span className="ov-mix-count">{s.count.toLocaleString("en-PK")}</span>
            <span className="ov-mix-label">
              {CYCLE_META[s.type].label} · {total ? Math.round((s.count / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>

      <div className="ov-hires">
        <div className="ov-meter-head">
          <span>New hires, last 12 months</span>
          <span className="mono">
            {hiresYear.toLocaleString("en-PK")} total · {data.newHiresThisQuarter.toLocaleString("en-PK")} this quarter
          </span>
        </div>
        <div className="ov-hires-bars">
          {hires.map((h) => (
            <div className="ov-hires-col" key={h.month} title={`${h.month}: ${h.count} joined`}>
              <span className="ov-hires-bar" style={{ height: `${Math.max(6, (h.count / hireMax) * 100)}%` }} />
              <span className="ov-hires-month">{h.month[0]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
