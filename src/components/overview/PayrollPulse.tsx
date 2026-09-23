import { Link } from "react-router-dom";
import type { PayrollMonthPoint } from "../../data/mockData";
import { MonthlySalaryChart } from "../payroll/MonthlySalaryChart";
import { CYCLE_META, formatMonthKey, formatRs, pctChange } from "../payroll/payrollFormat";

function Delta({ value }: { value: number | null }) {
  if (value === null) return null;
  const dir = value >= 0 ? "up" : "down";
  return (
    <span className={`stat-delta ${dir}`}>
      {dir === "up" ? "▲" : "▼"} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

/**
 * Twelve months of paid salary beside the latest complete month's headline
 * figures. The month still in progress is drawn faded in the chart and left
 * out of the figures, so the stats never describe a half-posted month.
 */
export function PayrollPulse({ data }: { data: PayrollMonthPoint[] }) {
  const complete = data.filter((m) => m.complete && m.paid > 0);
  const latest = complete[complete.length - 1];
  const previous = complete[complete.length - 2];

  const avgPerHead = latest && latest.employeesPaid > 0 ? latest.paid / latest.employeesPaid : 0;
  const deductionPct = latest && latest.gross > 0 ? (latest.deductions / latest.gross) * 100 : 0;
  const permanentShare = latest && latest.paid > 0 ? (latest.permanent / latest.paid) * 100 : 0;

  return (
    <div className="chart-grid ov-pulse">
      <div className="card chart-card load-in load-in-2">
        <div className="chart-card-head">
          <div>
            <div className="chart-title">Payroll rhythm</div>
            <div className="chart-sub">Paid salary per month, last 12 months, stacked by pay cycle</div>
          </div>
          <Link className="mini-chart-link" to="/payroll">
            View detail →
          </Link>
        </div>
        <MonthlySalaryChart data={data} filter="all" height={220} />
        <div className="legend-row ov-legend">
          {(["Permanent", "Daily Wage"] as const).map((t) => (
            <span className="legend-item" key={t}>
              <span className="legend-swatch" style={{ background: CYCLE_META[t].color }} />
              {CYCLE_META[t].label} · {CYCLE_META[t].cycle.toLowerCase()}
            </span>
          ))}
        </div>
      </div>

      <div className="card ov-pulse-stats load-in load-in-3">
        <div className="card-label">
          LATEST COMPLETE MONTH{latest ? ` — ${formatMonthKey(latest.key).toUpperCase()}` : ""}
        </div>
        {latest ? (
          <>
            <div className="ov-stat">
              <div className="ov-stat-value">{formatRs(latest.paid)}</div>
              <div className="stat-foot">
                <Delta value={pctChange(latest.paid, previous?.paid ?? 0)} />
                <span>paid salary vs previous month</span>
              </div>
            </div>
            <div className="ov-stat-row">
              <div className="ov-stat">
                <div className="ov-stat-value sm">{latest.employeesPaid.toLocaleString("en-PK")}</div>
                <div className="stat-foot">
                  <Delta value={pctChange(latest.employeesPaid, previous?.employeesPaid ?? 0)} />
                  <span>employees paid</span>
                </div>
              </div>
              <div className="ov-stat">
                <div className="ov-stat-value sm">{formatRs(Math.round(avgPerHead))}</div>
                <div className="stat-foot">
                  <span>average per employee</span>
                </div>
              </div>
            </div>
            <div className="ov-meter">
              <div className="ov-meter-head">
                <span>Pay cycle split</span>
                <span className="mono">{permanentShare.toFixed(0)}% permanent</span>
              </div>
              <div className="ov-meter-track">
                <span
                  className="ov-meter-fill"
                  style={{ width: `${permanentShare}%`, background: CYCLE_META.Permanent.color }}
                />
                <span
                  className="ov-meter-fill"
                  style={{ width: `${100 - permanentShare}%`, background: CYCLE_META["Daily Wage"].color }}
                />
              </div>
            </div>
            <div className="ov-meter">
              <div className="ov-meter-head">
                <span>Deductions of gross</span>
                <span className="mono">{deductionPct.toFixed(1)}%</span>
              </div>
              <div className="ov-meter-track">
                <span className="ov-meter-fill" style={{ width: `${deductionPct}%`, background: "var(--data-rust)" }} />
              </div>
            </div>
          </>
        ) : (
          <p className="chart-sub">No complete payroll month yet.</p>
        )}
      </div>
    </div>
  );
}
