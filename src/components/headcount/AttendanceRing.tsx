import { fmtInt, fmtPct, toneFor, type CountRow } from "./hcShared";

const R = 64;
const STROKE = 16;
const C = 2 * Math.PI * R;

/** Ring of attendance statuses with the present share in the middle. */
export function AttendanceRing({ rows, dateLabel }: { rows: CountRow[]; dateLabel: string }) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  const present = rows.find((r) => r.key === "Present")?.count ?? 0;

  const arcs = rows
    .map((r, i) => ({ key: r.key, color: toneFor(r.key, i), len: total ? (r.count / total) * C : 0 }))
    .filter((a) => a.len > 0)
    .map((a, i, all) => ({ ...a, offset: all.slice(0, i).reduce((s, x) => s + x.len, 0) }));

  if (total === 0) {
    return <div className="hc-empty">No attendance posted for {dateLabel} for this selection.</div>;
  }

  return (
    <div className="hc-ring-wrap">
      <svg viewBox="0 0 160 160" className="hc-ring" role="img" aria-label={`Present ${present} of ${total}`}>
        <circle cx="80" cy="80" r={R} fill="none" stroke="var(--hc-line)" strokeWidth={STROKE} />
        {arcs.map((a) => (
          <circle
            key={a.key}
            cx="80"
            cy="80"
            r={R}
            fill="none"
            stroke={a.color}
            strokeWidth={STROKE}
            strokeDasharray={`${Math.max(a.len - 2, 0.5)} ${C}`}
            strokeDashoffset={-a.offset}
            transform="rotate(-90 80 80)"
          />
        ))}
        <text x="80" y="78" textAnchor="middle" className="hc-ring-big">
          {fmtPct(present, total)}
        </text>
        <text x="80" y="98" textAnchor="middle" className="hc-ring-small">
          present
        </text>
      </svg>
      <ul className="hc-ring-legend">
        {rows.map((r, i) => (
          <li key={r.key}>
            <i style={{ background: toneFor(r.key, i) }} />
            <span>{r.label}</span>
            <b>{fmtInt(r.count)}</b>
          </li>
        ))}
        <li className="hc-ring-total">
          <span>Total</span>
          <b>{fmtInt(total)}</b>
        </li>
      </ul>
    </div>
  );
}
