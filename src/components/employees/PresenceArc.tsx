const SIZE = 120;
const STROKE = 12;
const RADIUS = (SIZE - STROKE) / 2;
const HALF_CIRC = Math.PI * RADIUS;

export function PresenceArc({ pct }: { pct: number }) {
  const offset = HALF_CIRC - HALF_CIRC * (pct / 100);

  return (
    <div className="emp-arc-wrap">
      <svg width={SIZE} height={SIZE / 2 + STROKE / 2} viewBox={`0 0 ${SIZE} ${SIZE / 2 + STROKE / 2}`} role="img" aria-label={`${pct}% present today`}>
        <path
          d={`M ${STROKE / 2} ${SIZE / 2} A ${RADIUS} ${RADIUS} 0 0 1 ${SIZE - STROKE / 2} ${SIZE / 2}`}
          fill="none"
          stroke="var(--emp-line)"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
        <path
          d={`M ${STROKE / 2} ${SIZE / 2} A ${RADIUS} ${RADIUS} 0 0 1 ${SIZE - STROKE / 2} ${SIZE / 2}`}
          fill="none"
          stroke="var(--emp-moss)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={HALF_CIRC}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.2,0.7,0.2,1)" }}
        />
      </svg>
      <div>
        <div className="emp-arc-value">{pct}%</div>
        <div className="emp-arc-label">present today</div>
      </div>
    </div>
  );
}
