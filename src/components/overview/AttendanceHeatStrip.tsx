import { Link } from "react-router-dom";
import type { AttendancePoint } from "../../data/mockData";

function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
}

/** Present share of the rows that could have been present; null on a day with no working rows. */
function presentShare(p: AttendancePoint): number | null {
  const working = p.present + p.halfDay + p.absent;
  return working > 0 ? p.present / working : null;
}

/**
 * One cell per day for the last 30 days, shaded by the share of attendance
 * records that were Present. Days with no working rows (holidays, weekends,
 * not yet posted) stay hollow so a quiet day never reads as a bad one.
 */
export function AttendanceHeatStrip({ data }: { data: AttendancePoint[] }) {
  const shares = data.map((p) => ({ point: p, share: presentShare(p) }));
  const working = shares.filter((s): s is { point: AttendancePoint; share: number } => s.share !== null);
  const avg = working.length ? working.reduce((a, s) => a + s.share, 0) / working.length : 0;
  const best = working.reduce<(typeof working)[number] | null>((b, s) => (!b || s.share > b.share ? s : b), null);
  const worst = working.reduce<(typeof working)[number] | null>((b, s) => (!b || s.share < b.share ? s : b), null);
  const streak = [...shares].reverse().findIndex((s) => s.share === null || s.share < avg);
  const daysAboveAvg = streak === -1 ? working.length : streak;

  return (
    <div className="card chart-card load-in load-in-2">
      <div className="chart-card-head">
        <div>
          <div className="chart-title">Attendance rhythm</div>
          <div className="chart-sub">Share of records present, one cell per day, last 30 days</div>
        </div>
        <Link className="mini-chart-link" to="/attendance">
          View detail →
        </Link>
      </div>

      <div className="ov-heat">
        {shares.map(({ point, share }) => (
          <span
            key={point.date}
            className={`ov-heat-cell${share === null ? " empty" : ""}`}
            style={share === null ? undefined : { opacity: 0.18 + share * 0.82 }}
            title={
              share === null
                ? `${shortDate(point.date)}: no working records`
                : `${shortDate(point.date)}: ${(share * 100).toFixed(0)}% present · ${point.present} of ${
                    point.present + point.halfDay + point.absent
                  }`
            }
          />
        ))}
      </div>
      <div className="ov-heat-axis">
        <span>{data[0] ? shortDate(data[0].date) : ""}</span>
        <span>{data[data.length - 1] ? shortDate(data[data.length - 1].date) : ""}</span>
      </div>

      <div className="ov-heat-facts">
        <div>
          <div className="ov-fact-value">{(avg * 100).toFixed(0)}%</div>
          <div className="ov-fact-label">average present, working days</div>
        </div>
        <div>
          <div className="ov-fact-value good">{best ? `${(best.share * 100).toFixed(0)}%` : "—"}</div>
          <div className="ov-fact-label">best · {best ? shortDate(best.point.date) : "no data"}</div>
        </div>
        <div>
          <div className="ov-fact-value rust">{worst ? `${(worst.share * 100).toFixed(0)}%` : "—"}</div>
          <div className="ov-fact-label">lowest · {worst ? shortDate(worst.point.date) : "no data"}</div>
        </div>
        <div>
          <div className="ov-fact-value">{daysAboveAvg}</div>
          <div className="ov-fact-label">recent days at or above average</div>
        </div>
      </div>
    </div>
  );
}
