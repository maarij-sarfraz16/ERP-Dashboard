import { formatAttendanceDate } from "../kpi/formatAttendanceDate";

export function EmployeeHero({
  totalActive,
  joinedLast7d,
  dailyWageCount,
  newHiresThisQuarter,
  presentTodayPct,
  presenceDate,
}: {
  totalActive: number;
  joinedLast7d: number;
  dailyWageCount: number;
  newHiresThisQuarter: number;
  presentTodayPct: number;
  presenceDate: string | null;
}) {
  return (
    <div className="emp-hero load-in">
      <div>
        <div className="emp-hero-figure">{totalActive.toLocaleString()}</div>
        <div className="emp-hero-caption">active employees</div>
      </div>

      <div className="emp-hero-stats">
        <div className="emp-hero-stat">
          <span className="emp-hero-stat-value" style={{ color: "var(--emp-moss)" }}>
            +{joinedLast7d}
          </span>
          <span className="emp-hero-stat-label">joined in last 7 days</span>
        </div>
        <div className="emp-hero-stat">
          <span className="emp-hero-stat-value">{dailyWageCount}</span>
          <span className="emp-hero-stat-label">active daily-wage</span>
        </div>
        <div className="emp-hero-stat">
          <span className="emp-hero-stat-value" style={{ color: "var(--emp-gold)" }}>
            {newHiresThisQuarter}
          </span>
          <span className="emp-hero-stat-label">joined this quarter</span>
        </div>
        <div className="emp-hero-stat">
          <span className="emp-hero-stat-value">{presentTodayPct}%</span>
          <span className="emp-hero-stat-label">present · {formatAttendanceDate(presenceDate)}</span>
        </div>
      </div>
    </div>
  );
}
