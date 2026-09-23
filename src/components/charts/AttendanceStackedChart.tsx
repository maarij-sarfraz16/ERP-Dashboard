import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AttendancePoint } from "../../data/mockData";
import { ChartTooltip } from "./ChartTooltip";

function formatLabel(raw: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(raw);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  return raw;
}

export function AttendanceStackedChart({
  data,
  height = 220,
}: {
  data: AttendancePoint[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} barCategoryGap={data.length > 20 ? 1 : 6} margin={{ left: 0, right: 4, top: 4 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
        <XAxis
          dataKey="date"
          tickFormatter={formatLabel}
          tick={{ fill: "var(--ink-muted)", fontSize: 10.5, fontFamily: "var(--font-mono)" }}
          axisLine={{ stroke: "var(--border)" }}
          tickLine={false}
          interval={data.length > 20 ? Math.floor(data.length / 8) : 0}
          minTickGap={12}
        />
        <YAxis
          tick={{ fill: "var(--ink-muted)", fontSize: 10.5, fontFamily: "var(--font-mono)" }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip
          cursor={{ fill: "var(--surface-recessed)" }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <ChartTooltip
                title={formatLabel(String(label))}
                rows={payload
                  .slice()
                  .reverse()
                  .map((p) => ({
                    label: p.name === "present" ? "Present" : p.name === "late" ? "Late" : "Absent",
                    value: String(p.value),
                    color: p.color ?? "#fff",
                  }))}
              />
            );
          }}
        />
        <Bar dataKey="present" stackId="a" fill="var(--data-green)" radius={0} />
        <Bar dataKey="late" stackId="a" fill="var(--data-amber)" radius={0} />
        <Bar dataKey="absent" stackId="a" fill="var(--data-rust)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
