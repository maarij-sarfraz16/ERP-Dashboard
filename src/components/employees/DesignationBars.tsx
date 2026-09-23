import type { DesignationHeadcount } from "../../data/employeeData";

/** Bars with more people than this show the full gradient across their width. */
const GRADIENT_MIN_COUNT = 10;

export function DesignationBars({ data }: { data: DesignationHeadcount[] }) {
  const max = Math.max(...data.map((d) => d.count));

  return (
    <div className="emp-designation-list">
      {data.map((d) => {
        const pct = max > 0 ? (d.count / max) * 100 : 0;
        return (
        <div className="emp-split-row" key={d.designation}>
          <span className="emp-split-label emp-designation-label" title={d.designation}>
            {d.designation}
          </span>
          <span className="emp-split-track">
            <span
              className="emp-split-fill emp-designation-fill"
              style={{
                width: `${pct}%`,
                // Bars above the threshold spread the full green → gold → coral
                // across their own width; tiny bars stay solid green.
                backgroundSize: d.count > GRADIENT_MIN_COUNT ? "100% 100%" : "1000% 100%",
              }}
            />
          </span>
          <span className="emp-split-count">{d.count}</span>
        </div>
        );
      })}
    </div>
  );
}
