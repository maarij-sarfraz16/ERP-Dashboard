export function EmployeeHero({
  totalActive,
  activeDelta7d,
  dailyWageCount,
  newHiresThisQuarter,
  presentTodayPct,
}: {
  totalActive: number;
  activeDelta7d: number;
  dailyWageCount: number;
  newHiresThisQuarter: number;
  presentTodayPct: number;
}) {
  return (
    <div className="emp-hero load-in">
      <div>
        <div className="emp-hero-figure">{totalActive.toLocaleString()}</div>
        <div className="emp-hero-caption">people keep the floor running today</div>
      </div>

      <div className="emp-hero-stats">
        <div className="emp-hero-stat">
          <span className="emp-hero-stat-value" style={{ color: "var(--emp-moss)" }}>
            +{activeDelta7d}%
          </span>
          <span className="emp-hero-stat-label">vs. last week</span>
        </div>
        <div className="emp-hero-stat">
          <span className="emp-hero-stat-value">{dailyWageCount}</span>
          <span className="emp-hero-stat-label">daily-wage</span>
        </div>
        <div className="emp-hero-stat">
          <span className="emp-hero-stat-value" style={{ color: "var(--emp-gold)" }}>
            {newHiresThisQuarter}
          </span>
          <span className="emp-hero-stat-label">joined this quarter</span>
        </div>
        <div className="emp-hero-stat">
          <span className="emp-hero-stat-value">{presentTodayPct}%</span>
          <span className="emp-hero-stat-label">present today</span>
        </div>
      </div>
    </div>
  );
}
