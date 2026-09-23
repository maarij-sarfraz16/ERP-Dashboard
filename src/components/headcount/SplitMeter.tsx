import { fmtInt, fmtPct, toneFor, type CountRow } from "./hcShared";

/**
 * One proportional bar split into segments, with a tile per segment below it.
 * Clicking a tile (when `onPick` is given) filters the page by that value.
 */
export function SplitMeter({
  rows,
  active,
  onPick,
}: {
  rows: CountRow[];
  active?: string | null;
  onPick?: (key: string) => void;
}) {
  const total = rows.reduce((s, r) => s + r.count, 0);

  return (
    <div className="hc-split">
      <div className="hc-split-bar" role="img" aria-label={rows.map((r) => `${r.label} ${r.count}`).join(", ")}>
        {rows.map((r, i) =>
          r.count > 0 ? (
            <span
              key={r.key}
              style={{ flexGrow: r.count, background: toneFor(r.key, i) }}
              title={`${r.label}: ${fmtInt(r.count)}`}
            />
          ) : null,
        )}
      </div>
      <div className="hc-split-tiles">
        {rows.map((r, i) => {
          const body = (
            <>
              <span className="hc-split-label">
                <i style={{ background: toneFor(r.key, i) }} />
                {r.label}
              </span>
              <span className="hc-split-value">{fmtInt(r.count)}</span>
              <span className="hc-split-pct">{fmtPct(r.count, total)}</span>
            </>
          );
          return onPick ? (
            <button
              type="button"
              key={r.key}
              className={`hc-split-tile${active === r.key ? " is-active" : ""}`}
              onClick={() => onPick(r.key)}
              aria-pressed={active === r.key}
            >
              {body}
            </button>
          ) : (
            <div key={r.key} className="hc-split-tile">
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}
