import type { NewHirePoint } from "../../data/employeeData";

export function NewHiresStrip({ data }: { data: NewHirePoint[] }) {
  const max = Math.max(...data.map((d) => d.count));

  return (
    <div className="emp-hires-strip">
      {data.map((d) => (
        <div className="emp-hires-col" key={d.month}>
          <span
            className="emp-hires-dot"
            style={{ height: `${Math.max(8, (d.count / max) * 32)}px` }}
            title={`${d.month}: ${d.count} new hires`}
          />
          <span className="emp-hires-month">{d.month[0]}</span>
        </div>
      ))}
    </div>
  );
}
