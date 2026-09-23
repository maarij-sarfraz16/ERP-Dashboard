import type { DepartmentHeadcount } from "../../data/employeeData";
import { colorForIndex, opacityForIndex } from "./empPalette";

export function DepartmentCompositionBar({ data }: { data: DepartmentHeadcount[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div>
      <div className="emp-seg-bar load-in">
        {data.map((d, i) => (
          <div
            key={d.department}
            className="emp-seg"
            style={{
              width: `${(d.count / total) * 100}%`,
              background: colorForIndex(i),
              opacity: opacityForIndex(i),
            }}
            title={`${d.department}: ${d.count}`}
          />
        ))}
      </div>

      <div className="emp-seg-legend">
        {data.map((d, i) => (
          <div className="emp-seg-legend-item" key={d.department}>
            <span
              className="emp-seg-dot"
              style={{ background: colorForIndex(i), opacity: opacityForIndex(i) }}
            />
            <span className="emp-seg-legend-name">{d.department}</span>
            <span className="emp-seg-legend-count">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
