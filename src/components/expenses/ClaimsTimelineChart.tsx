import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "../charts/ChartTooltip";
import { fmtDate, fmtInt, fmtRs, fmtRsTick } from "./expenseFormat";

export interface TimelinePoint {
  /** Monday of the week, ISO. */
  week: string;
  approved: number;
  inProcess: number;
  rejected: number;
  count: number;
}

const SERIES: { key: keyof TimelinePoint; label: string; color: string }[] = [
  { key: "approved", label: "Approved", color: "var(--data-green)" },
  { key: "inProcess", label: "In process", color: "var(--data-amber)" },
  { key: "rejected", label: "Rejected", color: "var(--data-rust)" },
];

function shortWeek(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

/** Claimed amount per posting week, split by where the claim is in the workflow. */
export function ClaimsTimelineChart({ points }: { points: TimelinePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={points} margin={{ left: 4, right: 8, top: 8, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
        <XAxis
          dataKey="week"
          tickFormatter={shortWeek}
          tick={{ fill: "var(--ink-muted)", fontSize: 10.5, fontFamily: "var(--font-mono)" }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={fmtRsTick}
          tick={{ fill: "var(--ink-muted)", fontSize: 10.5, fontFamily: "var(--font-mono)" }}
          axisLine={false}
          tickLine={false}
          width={44}
        />
        <Tooltip
          cursor={{ fill: "var(--surface-recessed)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as TimelinePoint;
            return (
              <ChartTooltip
                title={`Week of ${fmtDate(d.week)} · ${fmtInt(d.count)} claims`}
                rows={SERIES.filter((s) => (d[s.key] as number) > 0).map((s) => ({
                  label: s.label,
                  value: fmtRs(d[s.key] as number),
                  color: s.color,
                }))}
              />
            );
          }}
        />
        {SERIES.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} stackId="claims" fill={s.color} isAnimationActive={false} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
