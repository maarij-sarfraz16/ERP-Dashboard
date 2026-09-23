import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PayrollDeptPoint } from "../../data/mockData";
import { ChartTooltip } from "./ChartTooltip";

function formatCurrency(v: number): string {
  return `Rs ${(v / 100000).toFixed(1)}L`;
}

export function PayrollDeptChart({
  data,
  height = 280,
}: {
  data: PayrollDeptPoint[];
  height?: number;
}) {
  const max = Math.max(...data.map((d) => d.cost));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 4, right: 24, top: 4, bottom: 4 }}
        barCategoryGap={10}
      >
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis
          type="number"
          tickFormatter={formatCurrency}
          tick={{ fill: "var(--ink-muted)", fontSize: 10.5, fontFamily: "var(--font-mono)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="department"
          tick={{ fill: "var(--ink)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={100}
        />
        <Tooltip
          cursor={{ fill: "var(--surface-recessed)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const point = payload[0].payload as PayrollDeptPoint;
            return (
              <ChartTooltip
                title={point.department}
                rows={[{ label: "Cost", value: formatCurrency(point.cost), color: "var(--data-indigo)" }]}
              />
            );
          }}
        />
        <Bar dataKey="cost" radius={[0, 3, 3, 0]}>
          {data.map((d) => (
            <Cell
              key={d.department}
              fill="var(--data-indigo)"
              fillOpacity={0.4 + 0.6 * (d.cost / max)}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
