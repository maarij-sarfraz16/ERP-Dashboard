import { Link } from "react-router-dom";
import type { GratuityReport } from "../../data/employeeData";
import { formatRs } from "../payroll/payrollFormat";

/**
 * The ATS gratuity report's Grand Total row as a single ring: consumed
 * against total liability. Figures are the report's own — nothing estimated.
 */
export function GratuityGlance({ report }: { report: GratuityReport | null }) {
  const pct = report ? Math.min(100, Math.max(0, report.totals.consumedPct)) : 0;
  const r = 44;
  const c = 2 * Math.PI * r;

  return (
    <div className="card chart-card load-in load-in-5">
      <div className="chart-card-head">
        <div>
          <div className="chart-title">Gratuity</div>
          <div className="chart-sub">Consumed against total liability, all employees</div>
        </div>
        <Link className="mini-chart-link" to="/gratuity-report">
          View report →
        </Link>
      </div>

      {!report ? (
        <p className="chart-sub">The gratuity report could not be loaded.</p>
      ) : (
        <div className="ov-grat">
          <div className="ov-ring">
            <svg viewBox="0 0 110 110" width="118" height="118" role="img" aria-label={`${pct}% consumed`}>
              <circle cx="55" cy="55" r={r} fill="none" stroke="var(--surface-recessed)" strokeWidth="10" />
              <circle
                cx="55"
                cy="55"
                r={r}
                fill="none"
                stroke="var(--data-indigo)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={c * (1 - pct / 100)}
                transform="rotate(-90 55 55)"
                className="ov-ring-arc"
              />
            </svg>
            <div className="ov-ring-center">
              <span className="ov-ring-value">{pct.toFixed(0)}%</span>
              <span className="ov-ring-unit">consumed</span>
            </div>
          </div>
          <div className="ov-grat-facts">
            <div>
              <div className="ov-fact-label">Total liability</div>
              <div className="ov-fact-value">{formatRs(report.totals.total)}</div>
            </div>
            <div>
              <div className="ov-fact-label">Consumed</div>
              <div className="ov-fact-value indigo">{formatRs(report.totals.consumed)}</div>
            </div>
            <div>
              <div className="ov-fact-label">Remaining</div>
              <div className="ov-fact-value">{formatRs(report.totals.remaining)}</div>
            </div>
            <div>
              <div className="ov-fact-label">Employees</div>
              <div className="ov-fact-value">{report.totals.employees.toLocaleString("en-PK")}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
