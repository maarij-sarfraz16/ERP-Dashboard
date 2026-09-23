interface PresenceGaugeProps {
  presentPct: number;
  present: number;
  late: number;
  absent: number;
}

const SIZE = 168;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
// Gauge sweeps 270° (like a factory pressure dial), starting at -225°.
const SWEEP = 0.75;

function arcOffset(fraction: number): number {
  return CIRCUMFERENCE - CIRCUMFERENCE * SWEEP * fraction;
}

export function PresenceGauge({ presentPct, present, late, absent }: PresenceGaugeProps) {
  const trackOffset = arcOffset(1);
  const valueOffset = arcOffset(presentPct / 100);

  return (
    <div className="gauge-wrap">
      <div className="gauge-figure">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={`${presentPct}% present today`}>
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--border)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={trackOffset}
            transform={`rotate(135 ${SIZE / 2} ${SIZE / 2})`}
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--data-green)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={valueOffset}
            transform={`rotate(135 ${SIZE / 2} ${SIZE / 2})`}
            style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.2,0.7,0.2,1)" }}
          />
        </svg>
        <div className="gauge-center">
          <span className="gauge-value">{presentPct}%</span>
          <span className="gauge-unit">PRESENT</span>
        </div>
      </div>

      <div className="gauge-legend">
        <div className="gauge-legend-row">
          <span className="gauge-dot" style={{ background: "var(--data-green)" }} />
          <span className="gauge-legend-value mono">{present}</span>
          <span className="gauge-legend-label">present</span>
        </div>
        <div className="gauge-legend-row">
          <span className="gauge-dot" style={{ background: "var(--data-amber)" }} />
          <span className="gauge-legend-value mono">{late}</span>
          <span className="gauge-legend-label">late</span>
        </div>
        <div className="gauge-legend-row">
          <span className="gauge-dot" style={{ background: "var(--data-rust)" }} />
          <span className="gauge-legend-value mono">{absent}</span>
          <span className="gauge-legend-label">absent</span>
        </div>
      </div>
    </div>
  );
}
