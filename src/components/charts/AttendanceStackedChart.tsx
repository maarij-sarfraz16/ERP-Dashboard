import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AttendancePoint } from "../../data/mockData";
import { ChartTooltip } from "./ChartTooltip";

/**
 * One stacked segment per ATS attendance status, all in a single column per
 * day so the column's height is the number of attendance records. The Present
 * segment is the same figure as the ATS "Total Present" card.
 */
export const ATTENDANCE_SERIES = [
  { key: "present", label: "Present", color: "var(--data-green)" },
  { key: "halfDay", label: "Half day", color: "var(--data-indigo)" },
  { key: "absent", label: "Absent", color: "var(--data-rust)" },
  { key: "holiday", label: "Holiday", color: "var(--border-strong)" },
] as const satisfies readonly { key: keyof AttendancePoint; label: string; color: string }[];

/**
 * Late entries are a flag on top of a status (the ATS "Late Entry" card counts
 * it on any status), so they overlap the bands and are drawn as a line rather
 * than stacked.
 */
export const LATE_SERIES = { key: "late", label: "Late entry", color: "var(--data-amber)" } as const;

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
      <ComposedChart
        data={data}
        barCategoryGap={data.length > 20 ? 2 : 8}
        margin={{ left: 0, right: 4, top: 4 }}
      >
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
                  { label: LATE_SERIES.label, value: point.late.toLocaleString(), color: LATE_SERIES.color },
                  { label: "Records", value: total.toLocaleString(), color: "var(--ink-on-accent)" },
                ]}
              />
            );
          }}
        />
        {ATTENDANCE_SERIES.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} stackId="a" fill={s.color} />
        ))}
        <Line
          type="monotone"
          dataKey={LATE_SERIES.key}
          name={LATE_SERIES.label}
          stroke={LATE_SERIES.color}
          strokeWidth={2}
          dot={data.length <= 20 ? { r: 3, fill: LATE_SERIES.color, strokeWidth: 0 } : false}
          activeDot={{ r: 4 }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
