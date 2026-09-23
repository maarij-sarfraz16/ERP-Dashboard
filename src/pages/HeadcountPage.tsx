import "../styles/headcount.css";
import { useMemo, useState } from "react";
import type { HeadcountEmployee } from "../api/headcountApi";
import { cleanDepartment, isoDaysAgo, today } from "../api/frappeMappers";
import { useHeadcountData } from "../hooks/useHeadcountData";
import { PageHead } from "../components/common/PageHead";
import { SplitMeter } from "../components/headcount/SplitMeter";
import { RankedBars } from "../components/headcount/RankedBars";
import { AttendanceRing } from "../components/headcount/AttendanceRing";
import { PeopleList } from "../components/headcount/PeopleList";
import { countBy, fmtDate, fmtInt, labelOf } from "../components/headcount/hcShared";

/** `null` = "All". A string (possibly `""` for blank) = that exact value. */
type Filter = string | null;

interface Filters {
  status: Filter;
  department: Filter;
  reason: Filter;
  marital: Filter;
}

const NO_FILTERS: Filters = { status: null, department: null, reason: null, marital: null };

const WINDOWS = [8, 30, 90];

const ALL = "__all__";
const BLANK = "__blank__";

function FilterSelect({
  label,
  value,
  options,
  onChange,
  format = labelOf,
}: {
  label: string;
  value: Filter;
  options: string[];
  onChange: (v: Filter) => void;
  format?: (v: string) => string;
}) {
  const encoded = value === null ? ALL : value === "" ? BLANK : value;
  return (
    <label className={`hc-filter${value !== null ? " is-set" : ""}`}>
      <span>{label}</span>
      <select
        value={encoded}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === ALL ? null : v === BLANK ? "" : v);
        }}
      >
        <option value={ALL}>All</option>
        {options.map((o) => (
          <option key={o || BLANK} value={o || BLANK}>
            {format(o)}
          </option>
        ))}
      </select>
    </label>
  );
}

function distinct(employees: HeadcountEmployee[], pick: (e: HeadcountEmployee) => string): string[] {
  return [...new Set(employees.map(pick))].sort((a, b) => {
    if (!a) return 1;
    if (!b) return -1;
    return a.localeCompare(b);
  });
}

function inWindow(iso: string, from: string, to: string): boolean {
  return Boolean(iso) && iso >= from && iso <= to;
}

export function HeadcountPage() {
  const { data, loading } = useHeadcountData();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [windowDays, setWindowDays] = useState(8);

  const employees = data?.employees;

  const options = useMemo(() => {
    const all = employees ?? [];
    return {
      status: distinct(all, (e) => e.status),
      department: distinct(all, (e) => e.department),
      reason: distinct(all, (e) => e.reasonForLeaving),
      marital: distinct(all, (e) => e.maritalStatus),
    };
  }, [employees]);

  const filtered = useMemo(
    () =>
      (employees ?? []).filter(
        (e) =>
          (filters.status === null || e.status === filters.status) &&
          (filters.department === null || e.department === filters.department) &&
          (filters.reason === null || e.reasonForLeaving === filters.reason) &&
          (filters.marital === null || e.maritalStatus === filters.marital),
      ),
    [employees, filters],
  );

  const view = useMemo(() => {
    const to = today();
    const from = isoDaysAgo(windowDays);
    const attendance = data?.attendanceByEmployee ?? new Map<string, string[]>();

    // Attendance records of the filtered roster, counted by their ATS status.
    // Employees with no record that day are counted apart, never as a status.
    const attendanceCounts = new Map<string, number>();
    let unmarked = 0;
    for (const e of filtered) {
      const statuses = attendance.get(e.id);
      if (!statuses) {
        if (e.status === "Active") unmarked += 1;
        continue;
      }
      for (const status of statuses) {
        attendanceCounts.set(status, (attendanceCounts.get(status) ?? 0) + 1);
      }
    }
    const attendanceRows = [...attendanceCounts.entries()]
      .map(([key, count]) => ({ key, label: key, count }))
      .sort((a, b) => b.count - a.count);

    return {
      status: countBy(filtered, (e) => e.status),
      salaryMode: countBy(filtered, (e) => e.salaryMode),
      bank: countBy(filtered, (e) => e.bankName),
      gender: countBy(filtered, (e) => e.gender),
      attendance: attendanceRows,
      unmarked,
      joined: filtered
        .filter((e) => inWindow(e.dateOfJoining, from, to))
        .sort((a, b) => b.dateOfJoining.localeCompare(a.dateOfJoining)),
      left: filtered
        .filter((e) => inWindow(e.relievingDate, from, to))
        .sort((a, b) => b.relievingDate.localeCompare(a.relievingDate)),
    };
  }, [filtered, data, windowDays]);

  const set = <K extends keyof Filters>(key: K) => (value: Filter) =>
    setFilters((f) => ({ ...f, [key]: value }));
  // Clicking the value that is already selected clears it again.
  const toggle = <K extends keyof Filters>(key: K) => (value: string) =>
    setFilters((f) => ({ ...f, [key]: f[key] === value ? null : value }));

  const anyFilter = Object.values(filters).some((v) => v !== null);
  const scopeText = [
    `Status=${filters.status === null ? "All" : labelOf(filters.status)}`,
    `Department=${filters.department === null ? "All" : cleanDepartment(filters.department) || "Not set"}`,
    filters.reason !== null && `Reason for Exit=${labelOf(filters.reason)}`,
    filters.marital !== null && `Marital Status=${labelOf(filters.marital)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const head = (
    <PageHead index="05 / 05" title="Workforce Snapshot" subtitle="Status, pay mode, attendance and movement — live from ATS HR" />
  );

  if (loading) {
    return (
      <div className="hc-page">
        {head}
        <p className="chart-sub">Loading workforce snapshot from HR…</p>
      </div>
    );
  }

  if (!data || !employees) {
    return (
      <div className="hc-page">
        {head}
        <div className="hc-card">
          <div className="hc-empty">The employee roster could not be loaded, so no figures are shown.</div>
        </div>
      </div>
    );
  }

  const attendanceLabel = data.attendanceDate
    ? data.attendanceDate === isoDaysAgo(1)
      ? `Yesterday · ${fmtDate(data.attendanceDate)}`
      : `Latest posted · ${fmtDate(data.attendanceDate)}`
    : "No attendance posted in the last week";

  return (
    <div className="hc-page">
      {head}

      <div className="hc-filterbar load-in">
        <FilterSelect label="Status" value={filters.status} options={options.status} onChange={set("status")} />
        <FilterSelect
          label="Department"
          value={filters.department}
          options={options.department}
          onChange={set("department")}
          format={(v) => (v ? cleanDepartment(v) : "Not set")}
        />
        <FilterSelect
          label="Reason for Exit"
          value={filters.reason}
          options={options.reason}
          onChange={set("reason")}
        />
        <FilterSelect
          label="Marital Status"
          value={filters.marital}
          options={options.marital}
          onChange={set("marital")}
        />
        <div className="hc-filterbar-end">
          <div className="hc-seg" role="group" aria-label="Joining / leaving window">
            {WINDOWS.map((d) => (
              <button
                key={d}
                type="button"
                className={windowDays === d ? "is-active" : ""}
                onClick={() => setWindowDays(d)}
              >
                {d}d
              </button>
            ))}
          </div>
          <button type="button" className="hc-clear" onClick={() => setFilters(NO_FILTERS)} disabled={!anyFilter}>
            Clear
          </button>
        </div>
      </div>

      <div className="hc-scope load-in">
        <span className="hc-scope-dot" />
        Workforce · {scopeText}
      </div>

      <div className="hc-grid">
        {/* ── By Head + By Status + By Gender ─────────────────────────── */}
        <section className="hc-card hc-hero load-in load-in-1">
          <header>
            <h2>By Head ({filters.status === null ? "All" : labelOf(filters.status)})</h2>
          </header>
          <div className="hc-hero-number">{fmtInt(filtered.length)}</div>
          <p className="hc-hero-sub">
            employees on record
            {anyFilter && <> · of {fmtInt(employees.length)} total</>}
          </p>
          <h3 className="hc-subhead">By Status wise</h3>
          <SplitMeter rows={view.status} active={filters.status} onPick={toggle("status")} />
          <h3 className="hc-subhead hc-subhead-gap">
            By Gender, {filters.status === null ? "All" : labelOf(filters.status)}
          </h3>
          <SplitMeter rows={view.gender} />
        </section>

        {/* ── Salary Payment Mode ─────────────────────────────────────── */}
        <section className="hc-card load-in load-in-2">
          <header>
            <h2>Salary Payment Mode</h2>
            <span className="hc-tag">Mode</span>
          </header>
          <SplitMeter rows={view.salaryMode} />
        </section>

        <section className="hc-card hc-span-2 load-in load-in-2">
          <header>
            <h2>Salary Payment Mode</h2>
            <span className="hc-tag">Bank</span>
          </header>
          <RankedBars rows={view.bank} initial={6} color="var(--hc-indigo)" />
        </section>

        {/* ── Yesterday Attendance Summary ────────────────────────────── */}
        <section className="hc-card hc-span-2 load-in load-in-3">
          <header>
            <h2>Yesterday Attendance Summary</h2>
            <span className="hc-tag">{attendanceLabel}</span>
          </header>
          <AttendanceRing rows={view.attendance} dateLabel={attendanceLabel} />
          {view.unmarked > 0 && (
            <p className="hc-hero-sub">
              {fmtInt(view.unmarked)} active employee{view.unmarked === 1 ? " has" : "s have"} no
              attendance record for this day.
            </p>
          )}
        </section>

        {/* ── New / Resigned ──────────────────────────────────────────── */}
        <section className="hc-card hc-people-card load-in load-in-4">
          <header>
            <h2>New Employees (Last {windowDays} days)</h2>
            <span className="hc-count hc-count-in">+{fmtInt(view.joined.length)}</span>
          </header>
          <PeopleList
            people={view.joined}
            dateOf={(e) => e.dateOfJoining}
            empty={`No one joined in the last ${windowDays} days.`}
          />
        </section>

        <section className="hc-card hc-people-card load-in load-in-4">
          <header>
            <h2>Resignations Employees (Last {windowDays} days)</h2>
            <span className="hc-count hc-count-out">−{fmtInt(view.left.length)}</span>
          </header>
          <PeopleList
            people={view.left}
            dateOf={(e) => e.relievingDate}
            detailOf={(e) => e.reasonForLeaving}
            empty={`No one left in the last ${windowDays} days.`}
          />
        </section>
      </div>

      <p className="hc-source">
        Source: HR Employee and Attendance records, read live. Blank fields are shown as “Not set”.
      </p>
    </div>
  );
}
