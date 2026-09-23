import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EmploymentType } from "../../data/mockData";
import { ChartTooltip } from "../charts/ChartTooltip";
import { CYCLE_META, formatRs, formatRsTick, type CycleFilter } from "./payrollFormat";

export interface DeptSalaryRow {
  department: string;
  permanent: number;
  dailyWage: number;
  total: number;
}

const ROW_HEIGHT = 30;
const LABEL_MAX = 22;

function truncate(s: string): string {
  return s.length > LABEL_MAX ? `${s.slice(0, LABEL_MAX - 1)}…` : s;
}

/** Horizontal bars, one row per department, stacked by staff group. */
export function DepartmentSalaryChart({
  rows,
  filter,
}: {
  rows: DeptSalaryRow[];
  filter: CycleFilter;
}) {
  const types: EmploymentType[] = filter === "all" ? ["Permanent", "Daily Wage"] : [filter];

  return (
    <ResponsiveContainer width="100%" height={Math.max(rows.length * ROW_HEIGHT + 36, 120)}>
      <BarChart
        data={rows}
        layout="vertical"
        margin={{ left: 4, right: 20, top: 4, bottom: 4 }}
        barCategoryGap={7}
      >
        <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 4" />
        <XAxis
          type="number"
          tickFormatter={formatRsTick}
          tick={{ fill: "var(--ink-muted)", fontSize: 10.5, fontFamily: "var(--font-mono)" }}
          axisLine={false}
          tickLine={false}
          orientation="top"
        />
        <YAxis
          type="category"
          dataKey="department"
          tickFormatter={truncate}
          tick={{ fill: "var(--ink)", fontSize: 11.5 }}
          axisLine={false}
          tickLine={false}
          width={160}
          interval={0}
        />
        <Tooltip
          cursor={{ fill: "var(--surface-recessed)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as DeptSalaryRow;
            return (
              <ChartTooltip
                title={d.department}
                rows={[
                  ...types.map((t) => ({
                    label: CYCLE_META[t].label,
                    value: formatRs(d[CYCLE_META[t].key]),
                    color: CYCLE_META[t].color,
                  })),
                  ...(types.length > 1
                    ? [{ label: "Total", value: formatRs(d.total), color: "var(--ink-on-accent)" }]
                    : []),
                ]}
              />
            );
          }}
        />
        {types.map((t, i) => {
          const isEnd = i === types.length - 1;
          return (
            <Bar
              key={t}
              dataKey={CYCLE_META[t].key}
              name={CYCLE_META[t].label}
              stackId="dept"
              fill={CYCLE_META[t].color}
              stroke="var(--surface)"
              strokeWidth={isEnd && types.length > 1 ? 2 : 0}
              radius={isEnd ? [0, 4, 4, 0] : [0, 0, 0, 0]}
            />
          );
        })}
      </BarChart>
    </ResponsiveContainer>
  );
}
