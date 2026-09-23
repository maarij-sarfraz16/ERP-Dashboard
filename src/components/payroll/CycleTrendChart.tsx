import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PayrollMonthPoint } from "../../data/mockData";
import { ChartTooltip } from "../charts/ChartTooltip";
import { formatRs, formatRsTick, trunc2 } from "./payrollFormat";

const AXIS_TICK = { fill: "var(--ink-muted)", fontSize: 10.5, fontFamily: "var(--font-mono)" };

/** Paid salary of one staff group per month, as a single filled line. */
export function CycleTrendChart({
  data,
  dataKey,
  label,
  color,
  height = 220,
}: {
  data: PayrollMonthPoint[];
  dataKey: "permanent" | "dailyWage";
  label: string;
  color: string;
  height?: number;
}) {
  const gradientId = `py-fill-${useId().replace(/:/g, "")}`;
  // A month with no run for this cycle (e.g. payroll was not processed at all)
  // is a gap in the record, not a zero cost — break the line there.
  const series = data.map((p) => ({ ...p, value: p[dataKey] > 0 ? p[dataKey] : null }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={series} margin={{ left: -8, right: 12, top: 10, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
        <XAxis
          dataKey="period"
          tick={AXIS_TICK}
          axisLine={{ stroke: "var(--border)" }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatRsTick}
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          width={58}
        />
        <Tooltip
          cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as PayrollMonthPoint;
            if (!p[dataKey]) {
              return (
                <ChartTooltip
                  title={p.period}
                  rows={[{ label, value: "No run posted", color }]}
                />
              );
            }
            return (
              <ChartTooltip
                title={p.complete ? p.period : `${p.period} · in progress`}
                rows={[
                  { label, value: formatRs(p[dataKey]), color },
                  {
                    label: "Share of month",
                    value: p.paid ? `${trunc2((p[dataKey] / p.paid) * 100)}%` : "—",
                    color: "var(--ink-on-accent)",
                  },
                ]}
              />
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={{ r: 3.5, fill: color, stroke: "var(--surface)", strokeWidth: 2 }}
          activeDot={{ r: 5.5, fill: color, stroke: "var(--surface)", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
