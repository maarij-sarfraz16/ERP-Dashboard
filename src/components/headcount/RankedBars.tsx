import { useState } from "react";
import { fmtInt, fmtPct, type CountRow } from "./hcShared";

/** Ranked horizontal bars with value + share, collapsible past `initial` rows. */
export function RankedBars({
  rows,
  initial = 12,
  color = "var(--hc-green)",
  onPick,
  active,
}: {
  rows: CountRow[];
  initial?: number;
  color?: string;
  onPick?: (key: string) => void;
  active?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const total = rows.reduce((s, r) => s + r.count, 0);
  const max = Math.max(1, ...rows.map((r) => r.count));
  const shown = expanded ? rows : rows.slice(0, initial);

  if (rows.length === 0) return <div className="hc-empty">No employees match these filters.</div>;

  return (
    <div className="hc-ranked">
      <div className="hc-ranked-head">
        <span>#</span>
        <span>Name</span>
        <span className="num">Value</span>
        <span className="num">Share</span>
      </div>
      <ol className="hc-ranked-list">
        {shown.map((r, i) => {
          const inner = (
            <>
              <span className="hc-rank">{String(i + 1).padStart(2, "0")}</span>
              <span className="hc-ranked-name" title={r.label}>
                {r.label}
                <span className="hc-ranked-track">
                  <span style={{ width: `${(r.count / max) * 100}%`, background: color }} />
                </span>
              </span>
              <span className="num hc-ranked-value">{fmtInt(r.count)}</span>
              <span className="num hc-ranked-pct">{fmtPct(r.count, total)}</span>
            </>
          );
          return (
            <li key={r.key || "__blank"}>
              {onPick ? (
                <button
                  type="button"
                  className={`hc-ranked-row${active === r.key ? " is-active" : ""}`}
                  onClick={() => onPick(r.key)}
                >
                  {inner}
                </button>
              ) : (
                <div className="hc-ranked-row">{inner}</div>
              )}
            </li>
          );
        })}
      </ol>
      {rows.length > initial && (
        <button type="button" className="hc-more" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Show top " + initial : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  );
}
