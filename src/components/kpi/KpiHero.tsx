import type { Kpis } from "../../data/mockData";
import { PresenceGauge } from "./PresenceGauge";

export function KpiHero({ kpis }: { kpis: Kpis }) {
  return (
    <div className="card bento-hero load-in load-in-1">
      <div className="hero-tile">
        <div>
          <div className="card-label">FLOOR STATUS — TODAY</div>
          <h2 style={{ fontSize: 16 }}>Attendance dial</h2>
        </div>
        <PresenceGauge
          presentPct={kpis.presentPct}
          present={kpis.presentToday}
          late={Math.round(kpis.totalEmployees * 0.03)}
          absent={kpis.absentToday}
        />
        <p className="chart-sub">
          {kpis.totalEmployees} employees on roster · updated live from shift terminals
        </p>
      </div>
    </div>
  );
}
