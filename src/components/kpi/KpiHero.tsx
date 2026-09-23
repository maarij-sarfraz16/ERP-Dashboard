import type { Kpis } from "../../data/mockData";
import { PresenceGauge } from "./PresenceGauge";
import { formatAttendanceDate } from "./formatAttendanceDate";

export function KpiHero({ kpis }: { kpis: Kpis }) {
  return (
    <div className="card bento-hero load-in load-in-1">
      <div className="hero-tile">
        <div>
          <div className="card-label">FLOOR STATUS — {formatAttendanceDate(kpis.attendanceDate).toUpperCase()}</div>
          <h2 style={{ fontSize: 16 }}>Attendance dial</h2>
        </div>
        <PresenceGauge
          presentPct={kpis.presentPct}
          present={kpis.presentToday}
          late={kpis.lateToday}
          absent={kpis.absentToday}
        />
        <p className="chart-sub">
          Present of {kpis.totalEmployees.toLocaleString()} active employees ·{" "}
          {kpis.attendanceRecordsPosted.toLocaleString()} attendance records posted
          {kpis.attendanceRecordsPosted < kpis.totalEmployees ? " so far" : ""}
        </p>
      </div>
    </div>
  );
}
