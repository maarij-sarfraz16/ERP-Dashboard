import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { LoanReportChart } from "../../data/loanData";
import { ChartTooltip } from "../charts/ChartTooltip";
import { fmtRs, fmtRsTick } from "./loanFormat";

const ROW_HEIGHT = 30;
const LABEL_MAX = 22;

function truncate(s: string): string {
  return s.length > LABEL_MAX ? `${s.slice(0, LABEL_MAX - 1)}…` : s;
}

interface Point {
  label: string;
  value: number;
  employeeId: string | null;
}

/**
 * The report's own chart, drawn from the labels/values the server sent —
 * the ranking, the cut-off and the figures are the report's, not ours.
 * Employee IDs are resolved client-side from the loan rows by name.
 */
export function TopBalancesChart({
  chart,
  employeeIds,
}: {
  chart: LoanReportChart;
  employeeIds?: Map<string, string>;
}) {
  const data: Point[] = chart.points.map((p) => ({
    ...p,
    employeeId: employeeIds?.get(p.label.trim().toUpperCase()) ?? null,
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(data.length * ROW_HEIGHT + 36, 120)}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 24, top: 4, bottom: 4 }} barCategoryGap={7}>
        <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 4" />
        <XAxis
          type="number"
          tickFormatter={fmtRsTick}
          tick={{ fill: "var(--ink-muted)", fontSize: 10.5, fontFamily: "var(--font-mono)" }}
          axisLine={false}
          tickLine={false}
          orientation="top"
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={({ x, y, index }: { x: number; y: number; index: number }) => {
            const d = data[index];
            return (
              <text x={x} y={y} textAnchor="end" dominantBaseline="central">
                {d?.employeeId && (
                  <tspan fill="var(--ink-muted)" fontSize={10} fontFamily="var(--font-mono)">
                    {d.employeeId}{" "}
                  </tspan>
                )}
                <tspan fill="var(--ink)" fontSize={11.5}>
                  {truncate(d?.label ?? "")}
                </tspan>
              </text>
            );
          }}
          axisLine={false}
          tickLine={false}
          width={230}
          interval={0}
        />
        <Tooltip
          cursor={{ fill: "var(--surface-recessed)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as Point;
            return (
              <ChartTooltip
                title={d.employeeId ? `${d.employeeId} · ${d.label}` : d.label}
                rows={[{ label: chart.series || "Value", value: fmtRs(d.value), color: "var(--data-rust)" }]}
              />
            );
          }}
        />
        <Bar dataKey="value" name={chart.series} fill="var(--data-rust)" radius={[0, 4, 4, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
