import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { OvertimeMonthPoint } from "../../data/employeeData";
import { ChartTooltip } from "../charts/ChartTooltip";
import { fmtHours, fmtHoursTick } from "../attendance/OvertimeSection";
import { CYCLE_META, formatMonthKey, formatRs } from "./payrollFormat";

const AXIS_TICK = { fill: "var(--ink-muted)", fontSize: 10.5, fontFamily: "var(--font-mono)" };

/**
 * Paid overtime hours per month from submitted salary slips, stacked
 * permanent (bottom) + daily wages (top) in the payroll colours. The
 * in-progress month is drawn faded, as on the salary chart above it.
 */
export function OvertimeMonthlyChart({ data, height = 280 }: { data: OvertimeMonthPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: -8, right: 12, top: 8, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
        <XAxis dataKey="label" tick={AXIS_TICK} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
        <YAxis tickFormatter={fmtHoursTick} tick={AXIS_TICK} axisLine={false} tickLine={false} width={48} />
        <Tooltip
          cursor={{ fill: "var(--surface-recessed)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as OvertimeMonthPoint;
            return (
              <ChartTooltip
                title={`${formatMonthKey(p.key)}${p.complete ? "" : " · in progress"}`}
                rows={[
                  { label: CYCLE_META.Permanent.label, value: fmtHours(p.permanentHours), color: CYCLE_META.Permanent.color },
                  { label: CYCLE_META["Daily Wage"].label, value: fmtHours(p.dailyWageHours), color: CYCLE_META["Daily Wage"].color },
                  { label: "Total hours", value: fmtHours(p.hours), color: "var(--ink-on-accent)" },
                  { label: "Amount", value: formatRs(p.amount), color: "var(--ink-on-accent)" },
                ]}
              />
            );
          }}
        />
        <Bar dataKey="permanentHours" name={CYCLE_META.Permanent.label} stackId="hours" fill={CYCLE_META.Permanent.color} maxBarSize={56}>
          {data.map((d) => (
            <Cell key={d.key} fillOpacity={d.complete ? 1 : 0.4} />
          ))}
        </Bar>
        <Bar
          dataKey="dailyWageHours"
          name={CYCLE_META["Daily Wage"].label}
          stackId="hours"
          fill={CYCLE_META["Daily Wage"].color}
          stroke="var(--surface)"
          strokeWidth={2}
          radius={[4, 4, 0, 0]}
          maxBarSize={56}
        >
          {data.map((d) => (
            <Cell key={d.key} fillOpacity={d.complete ? 1 : 0.4} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
