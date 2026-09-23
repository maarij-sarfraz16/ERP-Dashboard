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

/**
 * One segment per ATS attendance status, bottom to top. The segments are
 * disjoint, so a bar's height is the number of Attendance records for that
 * day — the same figure as ATS's "Daily Attendance Trend" chart.
 */
export const ATTENDANCE_SERIES = [
  { key: "present", label: "Present", color: "var(--data-green)" },
  { key: "late", label: "Present, late entry", color: "var(--data-amber)" },
  { key: "halfDay", label: "Half day", color: "var(--data-indigo)" },
  { key: "absent", label: "Absent", color: "var(--data-rust)" },
  { key: "holiday", label: "Holiday", color: "var(--border-strong)" },
] as const satisfies readonly { key: keyof AttendancePoint; label: string; color: string }[];

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
            const point = payload[0].payload as AttendancePoint;
            const total = ATTENDANCE_SERIES.reduce((sum, s) => sum + point[s.key], 0);
            return (
              <ChartTooltip
                title={formatLabel(String(label))}
                rows={[
                  ...ATTENDANCE_SERIES.filter((s) => point[s.key] > 0)
                    .reverse()
                    .map((s) => ({
                      label: s.label,
                      value: point[s.key].toLocaleString(),
                      color: s.color,
                    })),
                  { label: "Records", value: total.toLocaleString(), color: "var(--ink-on-accent)" },
                ]}
              />
            );
          }}
        />
        {ATTENDANCE_SERIES.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} stackId="a" fill={s.color} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
