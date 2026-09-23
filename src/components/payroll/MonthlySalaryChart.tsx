import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EmploymentType, PayrollMonthPoint } from "../../data/mockData";
import { ChartTooltip } from "../charts/ChartTooltip";
import { CYCLE_META, formatRs, formatRsTick, type CycleFilter } from "./payrollFormat";

const AXIS_TICK = { fill: "var(--ink-muted)", fontSize: 10.5, fontFamily: "var(--font-mono)" };

/**
 * Paid salary per month, stacked permanent (bottom) + daily wages (top). With a
 * cycle filter only that group is drawn, in the same colour it has when
 * stacked. The in-progress month is drawn faded: its runs are not all posted.
 */
export function MonthlySalaryChart({
  data,
  filter,
  height = 300,
}: {
  data: PayrollMonthPoint[];
  filter: CycleFilter;
  height?: number;
}) {
  const types: EmploymentType[] = filter === "all" ? ["Permanent", "Daily Wage"] : [filter];
  // The month total sits on top of whichever segment is drawn last.
  const totalKey = filter === "all" ? "paid" : CYCLE_META[filter].key;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: -8, right: 12, top: 24, bottom: 0 }} barCategoryGap="28%">
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
          width={60}
        />
        <Tooltip
          cursor={{ fill: "var(--surface-recessed)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as PayrollMonthPoint;
            return (
              <ChartTooltip
                title={p.complete ? p.period : `${p.period} · in progress`}
                rows={[
                  ...types.map((t) => ({
                    label: CYCLE_META[t].label,
                    value: formatRs(p[CYCLE_META[t].key]),
                    color: CYCLE_META[t].color,
                  })),
                  { label: "Paid salary", value: formatRs(p.paid), color: "var(--ink-on-accent)" },
                  { label: "Gross pay", value: formatRs(p.gross), color: "var(--ink-on-accent)" },
                  { label: "Deductions", value: formatRs(p.deductions), color: "var(--ink-on-accent)" },
                  { label: "Salary slips", value: p.slips.toLocaleString("en-PK"), color: "var(--ink-on-accent)" },
                ]}
              />
            );
          }}
        />
        {types.map((t, i) => {
          const isTop = i === types.length - 1;
          return (
            <Bar
              key={t}
              dataKey={CYCLE_META[t].key}
              name={CYCLE_META[t].label}
              stackId="salary"
              fill={CYCLE_META[t].color}
              stroke="var(--surface)"
              strokeWidth={isTop && types.length > 1 ? 2 : 0}
              radius={isTop ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              maxBarSize={56}
            >
              {data.map((p) => (
                <Cell key={p.key} fillOpacity={p.complete ? 1 : 0.4} />
              ))}
              {isTop && (
                <LabelList
                  dataKey={totalKey}
                  position="top"
                  offset={8}
                  formatter={(v: unknown) => formatRsTick(Number(v))}
                  style={{ fill: "var(--ink)", fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 500 }}
                />
              )}
            </Bar>
          );
        })}
      </BarChart>
    </ResponsiveContainer>
  );
}
