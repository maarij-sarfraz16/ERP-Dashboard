import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DepartmentHeadcount } from "../../data/employeeData";
import { ChartTooltip } from "./ChartTooltip";

export function HeadcountMiniChart({
  data,
  height = 220,
}: {
  data: DepartmentHeadcount[];
  height?: number;
}) {
  const top = data.slice(0, 5);
  const max = Math.max(...top.map((d) => d.count));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={top} layout="vertical" margin={{ left: 4, right: 24, top: 4, bottom: 4 }} barCategoryGap={10}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="department"
          tick={{ fill: "var(--ink)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={100}
        />
        <Tooltip
          cursor={{ fill: "var(--surface-recessed)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const point = payload[0].payload as DepartmentHeadcount;
            return (
              <ChartTooltip
                title={point.department}
                rows={[{ label: "Headcount", value: String(point.count), color: "var(--data-indigo)" }]}
              />
            );
          }}
        />
        <Bar dataKey="count" radius={[0, 3, 3, 0]}>
          {top.map((d) => (
            <Cell key={d.department} fill="var(--data-indigo)" fillOpacity={0.4 + 0.6 * (d.count / max)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
