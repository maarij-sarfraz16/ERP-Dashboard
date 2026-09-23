import "../styles/payroll.css";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useWorkforceData } from "../hooks/useWorkforceData";
import type { PayrollMonthPoint } from "../data/mockData";
import { PageHead } from "../components/common/PageHead";
import { SectionHeader } from "../components/common/SectionHeader";
import { EmploymentTypeBar } from "../components/charts/EmploymentTypeBar";
import { PayrollRunsTable } from "../components/payroll/PayrollRunsTable";
import { CycleTrendChart } from "../components/payroll/CycleTrendChart";
import { MonthlySalaryChart } from "../components/payroll/MonthlySalaryChart";
import { DepartmentSalaryChart } from "../components/payroll/DepartmentSalaryChart";
import { Segmented } from "../components/payroll/Segmented";
import {
  CYCLE_FILTERS,
  CYCLE_META,
  formatMonthKey,
  formatRs,
  pctChange,
  type CycleFilter,
} from "../components/payroll/payrollFormat";

const DEPT_TOP = 15;

function Delta({ current, previous, label }: { current: number; previous?: number; label: string }) {
  const pct = previous === undefined ? null : pctChange(current, previous);
  if (pct === null) return <span className="py-delta">— {label}</span>;
  const dir = pct > 0.05 ? "up" : pct < -0.05 ? "down" : "flat";
  const arrow = dir === "up" ? "▲" : dir === "down" ? "▼" : "■";
  return (
    <span className={`py-delta ${dir}`}>
      <span aria-hidden="true">{arrow}</span> {Math.abs(pct).toFixed(2)}% {label}
    </span>
  );
}

function StatTile({
  label,
  value,
  accent,
  foot,
  className = "",
}: {
  label: string;
  value: string;
  accent: string;
  foot: ReactNode;
  className?: string;
}) {
  return (
    <div className={`py-stat load-in ${className}`} style={{ "--py-accent": accent } as CSSProperties}>
      <div className="py-stat-label">{label}</div>
      <div className="py-stat-value">{value}</div>
      <div className="py-stat-foot">{foot}</div>
    </div>
  );
}

function cycleFilterOptions(counts?: Record<CycleFilter, number>) {
  return CYCLE_FILTERS.map((f) => ({
    ...f,
    color: f.value === "all" ? undefined : CYCLE_META[f.value].color,
    count: counts?.[f.value],
  }));
}

function Legend({ filter }: { filter: CycleFilter }) {
  const types = filter === "all" ? (["Permanent", "Daily Wage"] as const) : [filter];
  return (
    <div className="legend-row">
      {types.map((t) => (
        <span className="legend-item" key={t}>
          <span className="legend-swatch" style={{ background: CYCLE_META[t].color }} />
          {CYCLE_META[t].label}
        </span>
      ))}
    </div>
  );
}

export function PayrollPage() {
  const { data, loading } = useWorkforceData();
  const [monthFilter, setMonthFilter] = useState<CycleFilter>("all");
  const [deptFilter, setDeptFilter] = useState<CycleFilter>("all");
  const [deptMonth, setDeptMonth] = useState<string | null>(null);
  const [deptShowAll, setDeptShowAll] = useState(false);
  const [runFilter, setRunFilter] = useState<CycleFilter>("all");

  const monthly = useMemo(() => data?.payrollMonthly ?? [], [data]);
  // The current month is mid-cycle (the monthly run is only posted at month
  // end), so trends and headline figures stop at the last complete month.
  const complete = useMemo(() => {
    const done = monthly.filter((m) => m.complete);
    return done.length ? done : monthly;
  }, [monthly]);
  const inProgress = monthly.find((m) => !m.complete && m.paid > 0);

  const deptMonths = useMemo(() => {
    const keys = [...new Set((data?.payrollDeptMonthly ?? []).map((d) => d.month))];
    return keys.sort().reverse();
  }, [data]);
  const latestComplete = complete[complete.length - 1]?.key ?? deptMonths[0] ?? "";
  const selectedDeptMonth = deptMonth ?? latestComplete;

  const deptRows = useMemo(() => {
    return (data?.payrollDeptMonthly ?? [])
      .filter((d) => d.month === selectedDeptMonth)
      .map((d) => ({ ...d, total: d.permanent + d.dailyWage }))
      .map((d) => ({
        ...d,
        sortValue: deptFilter === "all" ? d.total : d[CYCLE_META[deptFilter].key],
      }))
      .filter((d) => d.sortValue > 0)
      .sort((a, b) => b.sortValue - a.sortValue);
  }, [data, selectedDeptMonth, deptFilter]);

  const runs = useMemo(() => data?.recentPayrollRuns ?? [], [data]);
  const runCounts = useMemo(
    () => ({
      all: runs.length,
      Permanent: runs.filter((r) => r.cycle === "Permanent").length,
      "Daily Wage": runs.filter((r) => r.cycle === "Daily Wage").length,
    }),
    [runs],
  );

  if (loading || !data) {
    return (
      <>
        <PageHead index="03 / 04" title="Payroll" subtitle="Cost tracking and run history" />
        <p className="chart-sub">Loading payroll records…</p>
      </>
    );
  }

  const latest: PayrollMonthPoint | undefined = complete[complete.length - 1];
  const previous: PayrollMonthPoint | undefined = complete[complete.length - 2];
  const monthName = latest ? formatMonthKey(latest.key) : "—";
  const vsLabel = previous ? `vs ${previous.period}` : "";

  const deptTotal = deptRows.reduce((s, d) => s + d.sortValue, 0);
  const visibleDepts = deptShowAll ? deptRows : deptRows.slice(0, DEPT_TOP);
  const topDept = deptRows[0];
  const filteredRuns = runFilter === "all" ? runs : runs.filter((r) => r.cycle === runFilter);

  return (
    <div className="py-page">
      <PageHead
        index="03 / 04"
        title="Payroll"
        subtitle={`Paid Salary from submitted salary slips, as ATS reports it · latest complete month ${monthName}`}
      />

      {latest && (
        <div className="py-stats">
          <StatTile
            className="load-in-1"
            label={`Paid salary · ${monthName}`}
            value={formatRs(latest.paid)}
            accent="var(--ink)"
            foot={<Delta current={latest.paid} previous={previous?.paid} label={vsLabel} />}
          />
          <StatTile
            className="load-in-2"
            label="Permanent · monthly cycle"
            value={formatRs(latest.permanent)}
            accent={CYCLE_META.Permanent.color}
            foot={<Delta current={latest.permanent} previous={previous?.permanent} label={vsLabel} />}
          />
          <StatTile
            className="load-in-3"
            label="Daily wages · semi-monthly cycle"
            value={formatRs(latest.dailyWage)}
            accent={CYCLE_META["Daily Wage"].color}
            foot={<Delta current={latest.dailyWage} previous={previous?.dailyWage} label={vsLabel} />}
          />
          <StatTile
            className="load-in-4"
            label="Employees paid"
            value={data.kpis.onPayrollThisCycle.toLocaleString("en-PK")}
            accent="var(--data-green)"
            foot={
              <span className="py-delta">
                {formatRs(latest.gross)} gross · {formatRs(latest.deductions)} deducted
              </span>
            }
          />
        </div>
      )}

      <SectionHeader index="01" title="Cost trend" />
      <div className="py-grid-3">
        {(["Daily Wage", "Permanent"] as const).map((type, i) => {
          const meta = CYCLE_META[type];
          return (
            <div
              key={type}
              className={`card chart-card py-card load-in load-in-${i + 1}`}
              style={{ "--py-accent": meta.color } as CSSProperties}
            >
              <div className="chart-card-head">
                <div>
                  <div className="py-card-kicker">
                    <span className="py-cycle-dot" style={{ background: meta.color }} />
                    {meta.cycle}
                  </div>
                  <div className="chart-title">{meta.label}</div>
                </div>
                {latest && (
                  <div className="py-card-figure">
                    <div className="py-card-value">{formatRs(latest[meta.key])}</div>
                    <Delta current={latest[meta.key]} previous={previous?.[meta.key]} label={vsLabel} />
                  </div>
                )}
              </div>
              <CycleTrendChart
                // Daily wages are paid twice a month, so the current month already
                // has posted runs worth showing; permanent staff are paid only at month end.
                data={type === "Daily Wage" && inProgress?.dailyWage ? [...complete, inProgress] : complete}
                dataKey={meta.key}
                label={meta.label}
                color={meta.color}
              />
            </div>
          );
        })}

        <div className="card chart-card py-card load-in load-in-3">
          <div className="chart-card-head">
            <div>
              <div className="chart-title">By employment type</div>
              <div className="chart-sub">Current cycle cost split</div>
            </div>
          </div>
          <EmploymentTypeBar data={data.employmentTypeBreakdown} />
        </div>
      </div>
      {inProgress && (
        <p className="py-note">
          {formatMonthKey(inProgress.key)} is in progress: shown in the daily-wages trend only —{" "}
          {formatRs(inProgress.paid)} posted so far across {inProgress.slips.toLocaleString("en-PK")} slips.
        </p>
      )}

      <SectionHeader index="02" title="Month-wise salary" />
      <div className="card chart-card py-card load-in load-in-2">
        <div className="chart-card-head py-head-wrap">
          <div>
            <div className="chart-title">Paid salary by month</div>
            <div className="chart-sub">
              {inProgress ? `${formatMonthKey(inProgress.key)} faded: in progress · ` : ""}hover a bar for
              gross, deductions and slip count
            </div>
          </div>
          <div className="py-controls">
            <Legend filter={monthFilter} />
            <Segmented label="Staff group" value={monthFilter} options={cycleFilterOptions()} onChange={setMonthFilter} />
          </div>
        </div>
        <MonthlySalaryChart data={monthly} filter={monthFilter} />
      </div>

      <SectionHeader index="03" title="Department-wise salary" />
      <div className="card chart-card py-card load-in load-in-3">
        <div className="chart-card-head py-head-wrap">
          <div>
            <div className="chart-title">Paid salary by department</div>
            <div className="chart-sub">
              {deptRows.length} departments · {formatRs(deptTotal)}
              {topDept && deptTotal > 0 && (
                <>
                  {" "}· highest {topDept.department} ({((topDept.sortValue / deptTotal) * 100).toFixed(2)}%)
                </>
              )}
            </div>
          </div>
          <div className="py-controls">
            <label className="py-select">
              <span>Month</span>
              <select value={selectedDeptMonth} onChange={(e) => setDeptMonth(e.target.value)}>
                {deptMonths.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthKey(m)}
                    {monthly.find((p) => p.key === m)?.complete === false ? " (in progress)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <Segmented label="Staff group" value={deptFilter} options={cycleFilterOptions()} onChange={setDeptFilter} />
          </div>
        </div>
        <div className="py-legend-line">
          <Legend filter={deptFilter} />
        </div>
        {deptRows.length ? (
          <DepartmentSalaryChart rows={visibleDepts} filter={deptFilter} />
        ) : (
          <p className="chart-sub py-empty">No salary slips for this selection.</p>
        )}
        {deptRows.length > DEPT_TOP && (
          <button type="button" className="py-more" onClick={() => setDeptShowAll((v) => !v)}>
            {deptShowAll ? `Show top ${DEPT_TOP}` : `Show all ${deptRows.length} departments`}
          </button>
        )}
      </div>

      <SectionHeader index="04" title="Payroll runs" />
      <div className="card py-card load-in load-in-4">
        <div className="chart-card-head py-head-wrap">
          <div>
            <div className="chart-title">Recent runs</div>
            <div className="chart-sub">One row per pay period and cycle, newest first</div>
          </div>
          <Segmented
            label="Pay cycle"
            value={runFilter}
            options={cycleFilterOptions(runCounts)}
            onChange={setRunFilter}
          />
        </div>
        <PayrollRunsTable rows={filteredRuns} />
      </div>
    </div>
  );
}
