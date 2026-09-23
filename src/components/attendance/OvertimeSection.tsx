import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { OvertimeDayPoint, OvertimeReport } from "../../data/employeeData";
import { ChartTooltip } from "../charts/ChartTooltip";
import { formatMonthKey } from "../payroll/payrollFormat";
import { MonthSelect } from "../common/MonthSelect";

const LOGGED_COLOR = "var(--data-indigo)";
const AXIS_TICK = { fill: "var(--ink-muted)", fontSize: 10.5, fontFamily: "var(--font-mono)" };

/** Exact amount, grouped by thousands — never rounded to k/M. */
function fmtAmount(v: number): string {
  return Math.round(v).toLocaleString("en-US");
}

/** Hours to the nearest whole hour: "179,427 h". */
export function fmtHours(v: number): string {
  return `${Math.round(v).toLocaleString("en-US")} h`;
}

/** Axis ticks only — the tooltip carries the exact figure. */
export function fmtHoursTick(v: number): string {
  return v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v));
}

function fmtDay(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Headline tiles, the 30-day logged-hours strip and the department split.
 * Paid overtime by month lives on the Payroll page, next to the salary it
 * is part of.
 *
 * `onMonthChange` receives the month key the reader picks; the caller
 * re-reads the report for it.
 */
export function OvertimeSection({
  report,
  loading,
  onMonthChange,
}: {
  report: OvertimeReport | null;
  loading: boolean;
  onMonthChange: (month: string) => void;
}) {
  if (loading) {
    return <p className="chart-sub">Loading overtime…</p>;
  }
  if (!report) {
    return (
      <div className="card load-in">
        <p className="chart-sub ot-empty">
          Overtime could not be read from Salary Slip / Attendance, so no figures are shown.
        </p>
      </div>
    );
  }

  const monthLabel = formatMonthKey(report.month);
  const inProgress = report.monthly.find((m) => !m.complete)?.key;
  // Every month with a slip, newest first, plus the current month even before
  // its first run so the picker never skips "now".
  const months = report.monthly
    .filter((m) => m.paid > 0 || !m.complete)
    .map((m) => m.key)
    .reverse();
  if (!months.includes(report.month)) months.unshift(report.month);
  const maxDeptHours = Math.max(0, ...report.byDepartment.map((d) => d.hours));
  const allowedPct =
    report.totalActive > 0 ? Math.round((report.allowedActive / report.totalActive) * 100) : 0;
  const loggedLast30 = report.daily.reduce((sum, d) => sum + d.hours, 0);
  const lastDay = report.daily[report.daily.length - 1]?.date ?? "";

  return (
    <div className="ot-section">
      <div className="ot-toolbar load-in">
        <MonthSelect value={report.month} months={months} inProgress={inProgress} onChange={onMonthChange} />
        <span>
          Paid overtime from submitted salary slips
          {report.month === inProgress ? " · month in progress, permanent slips post at month end" : ""}
        </span>
      </div>
      <div className="ot-stats">
        <div className="card bento-stat load-in load-in-1">
          <div>
            <div className="card-label">Overtime hours</div>
            <div className="stat-value">{fmtHours(report.hours)}</div>
          </div>
          <div className="stat-foot">paid · {monthLabel}</div>
        </div>
        <div className="card bento-stat load-in load-in-2">
          <div>
            <div className="card-label">Overtime amount</div>
            <div className="stat-value">{fmtAmount(report.amount)}</div>
          </div>
          <div className="stat-foot">PKR · {report.shareOfPaidPct}% of paid salary</div>
        </div>
        <div className="card bento-stat load-in load-in-3">
          <div>
            <div className="card-label">On overtime</div>
            <div className="stat-value">{report.employees.toLocaleString("en-US")}</div>
          </div>
          <div className="stat-foot">employees paid overtime · {monthLabel}</div>
        </div>
        <div className="card bento-stat load-in load-in-4">
          <div>
            <div className="card-label">Allowed overtime</div>
            <div className="stat-value">{report.allowedActive.toLocaleString("en-US")}</div>
          </div>
          <div className="stat-foot">
            {allowedPct}% of {report.totalActive.toLocaleString("en-US")} active
          </div>
        </div>
      </div>

      <div className="ot-grid">
        <div className="card chart-card load-in load-in-2">
          <div className="chart-card-head">
            <div>
              <div className="chart-title">Logged overtime, last 30 days</div>
              <div className="chart-sub">
                Hours on submitted attendance, to {fmtDay(lastDay)} · {fmtHours(loggedLast30)} in the window
              </div>
            </div>
          </div>
          <DailyChart data={report.daily} />
        </div>

        <div className="card chart-card load-in load-in-3">
          <div className="chart-card-head">
            <div>
              <div className="chart-title">Overtime by department</div>
              <div className="chart-sub">
                Paid hours · {monthLabel} · {report.byDepartment.length} departments
              </div>
            </div>
          </div>
          <div className="ot-depts">
            {report.byDepartment.map((d) => (
              <div
                className="ot-dept-row"
                key={d.id}
                title={`${d.id}: ${fmtHours(d.hours)} · PKR ${fmtAmount(d.amount)} · ${d.people} people`}
              >
                <span className="ot-dept-label">{d.department}</span>
                <span className="ot-dept-track">
                  <span
                    className="ot-dept-fill"
                    style={{ width: `${maxDeptHours > 0 ? (d.hours / maxDeptHours) * 100 : 0}%` }}
                  />
                </span>
                <span className="ot-dept-hours">{fmtHours(d.hours)}</span>
                <span className="ot-dept-people">{d.people} people</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DailyChart({ data }: { data: OvertimeDayPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
        <XAxis
          dataKey="date"
          tickFormatter={fmtDay}
          tick={AXIS_TICK}
          axisLine={{ stroke: "var(--border)" }}
          tickLine={false}
          interval={6}
        />
        <YAxis tickFormatter={fmtHoursTick} tick={AXIS_TICK} axisLine={false} tickLine={false} width={36} />
        <Tooltip
          cursor={{ stroke: "var(--border-strong)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as OvertimeDayPoint;
            return (
              <ChartTooltip
                title={fmtDay(p.date)}
                rows={[
                  { label: "Hours", value: fmtHours(p.hours), color: LOGGED_COLOR },
                  { label: "People", value: p.people.toLocaleString("en-US"), color: "var(--ink-on-accent)" },
                ]}
              />
            );
          }}
        />
        <Line
          type="monotone"
          dataKey="hours"
          stroke={LOGGED_COLOR}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
