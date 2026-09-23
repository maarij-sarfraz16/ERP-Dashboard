import type { EmploymentSplitPoint } from "../../data/employeeData";

const COLOR: Record<string, string> = {
  Permanent: "var(--emp-moss)",
  "Daily Wage": "var(--emp-plum)",
};

export function EmploymentSplitBars({ data }: { data: EmploymentSplitPoint[] }) {
  const max = Math.max(...data.map((d) => d.count));

  return (
    <div>
      {data.map((d) => (
        <div className="emp-split-row" key={d.type}>
          <span className="emp-split-label">{d.type}</span>
          <span className="emp-split-track">
            <span
              className="emp-split-fill"
              style={{ width: `${(d.count / max) * 100}%`, background: COLOR[d.type] }}
            />
          </span>
          <span className="emp-split-count">{d.count}</span>
        </div>
      ))}
    </div>
  );
}
