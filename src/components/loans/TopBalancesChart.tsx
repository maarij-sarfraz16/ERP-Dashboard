import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { LoanReportChart } from "../../data/loanData";
import { ChartTooltip } from "../charts/ChartTooltip";
import { fmtRs, fmtRsTick } from "./loanFormat";

const ROW_HEIGHT = 30;
const LABEL_MAX = 24;

function truncate(s: string): string {
  return s.length > LABEL_MAX ? `${s.slice(0, LABEL_MAX - 1)}…` : s;
}

/**
 * The report's own chart, drawn from the labels/values the server sent —
 * the ranking, the cut-off and the figures are the report's, not ours.
 */
export function TopBalancesChart({ chart }: { chart: LoanReportChart }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(chart.points.length * ROW_HEIGHT + 36, 120)}>
      <BarChart
        data={chart.points}
        layout="vertical"
        margin={{ left: 4, right: 24, top: 4, bottom: 4 }}
        barCategoryGap={7}
      >
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
          tickFormatter={truncate}
          tick={{ fill: "var(--ink)", fontSize: 11.5 }}
          axisLine={false}
          tickLine={false}
          width={170}
          interval={0}
        />
        <Tooltip
          cursor={{ fill: "var(--surface-recessed)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as { label: string; value: number };
            return (
              <ChartTooltip
                title={d.label}
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
