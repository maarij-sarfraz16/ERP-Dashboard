import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PayrollTrendPoint } from "../../data/mockData";
import { ChartTooltip } from "./ChartTooltip";

function formatCurrency(v: number): string {
  return `Rs ${(v / 100000).toFixed(1)}L`;
}

export function PayrollTrendChart({ data }: { data: PayrollTrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ left: -10, right: 16, top: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="period"
          tick={{ fill: "var(--ink-muted)", fontSize: 10.5, fontFamily: "var(--font-mono)" }}
          axisLine={{ stroke: "var(--border)" }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatCurrency}
          tick={{ fill: "var(--ink-muted)", fontSize: 10.5, fontFamily: "var(--font-mono)" }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip
          cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <ChartTooltip
                title={String(label)}
                rows={[
                  {
                    label: "Payroll cost",
                    value: formatCurrency(Number(payload[0].value)),
                    color: "var(--data-indigo)",
                  },
                ]}
              />
            );
          }}
        />
        <Line
          type="monotone"
          dataKey="amount"
          stroke="var(--data-indigo)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--data-indigo)", strokeWidth: 0 }}
          activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--surface)" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
