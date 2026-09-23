import type { EmploymentTypePoint } from "../../data/mockData";
import { formatRs as formatCurrency } from "../payroll/payrollFormat";

const COLORS: Record<string, string> = {
  Permanent: "var(--data-indigo)",
  "Daily Wage": "var(--data-amber)",
};

export function EmploymentTypeBar({ data }: { data: EmploymentTypePoint[] }) {
  const total = data.reduce((sum, d) => sum + d.amount, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, paddingTop: 6 }}>
      <div
        style={{
          display: "flex",
          height: 34,
          borderRadius: 4,
          overflow: "hidden",
          border: "1px solid var(--border)",
        }}
      >
        {data.map((d, i) => (
          <div
            key={d.type}
            style={{
              width: `${(d.amount / total) * 100}%`,
              background: COLORS[d.type],
              borderRight: i < data.length - 1 ? "2px solid var(--surface)" : "none",
            }}
            title={`${d.type}: ${formatCurrency(d.amount)}`}
          />
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {data.map((d) => (
          <div key={d.type} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              className="legend-swatch"
              style={{ background: COLORS[d.type], flexShrink: 0 }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{d.type}</div>
              <div className="chart-sub">{d.headcount} employees</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="mono" style={{ fontWeight: 500 }}>
                {formatCurrency(d.amount)}
              </div>
              <div className="chart-sub mono">
                {((d.amount / total) * 100).toFixed(2)}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
