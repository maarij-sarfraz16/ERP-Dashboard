import "../../styles/headcount.css";
import { useMemo, useState } from "react";
import type { HeadcountEmployee } from "../../data/employeeData";
import { cleanDepartment, compareEmployeeId, isoDaysAgo, today } from "../../api/frappeMappers";
import { SplitMeter } from "./SplitMeter";
import { RankedBars } from "./RankedBars";
import { AttendanceRing } from "./AttendanceRing";
import { PeopleList } from "./PeopleList";
import {
  AGE_BANDS,
  bankBreakdown,
  countBy,
  countByBand,
  fmtDate,
  fmtInt,
  labelOf,
  NO_SALARY_MODE,
  SERVICE_BANDS,
  yearsBetween,
} from "./hcShared";

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

const SENIOR_AGE = 60;
const LONG_SERVICE_YEARS = 20;

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

/**
 * Status, pay mode, yesterday's attendance and joiners / leavers over the
 * whole roster, with filters that apply to every card at once.
 */
export function WorkforceSnapshot({
  employees,
  attendanceDate,
  attendanceByEmployee,
}: {
  employees: HeadcountEmployee[];
  attendanceDate: string | null;
  attendanceByEmployee: Map<string, string[]>;
}) {
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [windowDays, setWindowDays] = useState(90);

  const options = useMemo(
    () => ({
      status: distinct(employees, (e) => e.status),
      department: distinct(employees, (e) => e.department),
      reason: distinct(employees, (e) => e.reasonForLeaving),
      marital: distinct(employees, (e) => e.maritalStatus),
    }),
    [employees],
  );

  const filtered = useMemo(
    () =>
      employees.filter(
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

    // Attendance records of the filtered roster, counted by their ATS status.
    // Employees with no record that day are counted apart, never as a status.
    const attendanceCounts = new Map<string, number>();
    let unmarked = 0;
    for (const e of filtered) {
      const statuses = attendanceByEmployee.get(e.id);
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

    // Pay mode and bank are money cards: only Active employees are paid, so
    // Inactive / Left staff are never counted here, whatever the Status filter
    // says. (The ATS main dashboard counts salary_mode over every Employee,
    // which is why its Cash/Bank totals run higher than these.)
    const onPayroll = filtered.filter((e) => e.status === "Active");

    // Age, length of service and branch placement are only meaningful for
    // people still on the roster, so the senior cards and the branch
    // headcount count Active employees as of today.
    const withAge = onPayroll
      .map((e) => ({ e, years: yearsBetween(e.dateOfBirth, to) }))
      .filter((r): r is { e: HeadcountEmployee; years: number } => r.years !== null);
    const withService = onPayroll
      .map((e) => ({ e, years: yearsBetween(e.dateOfJoining, to) }))
      .filter((r): r is { e: HeadcountEmployee; years: number } => r.years !== null);

    // Every people list is ordered by employee id; the date/years each row
    // shows still say when they joined, left, or how long they have served.
    const byId = (a: HeadcountEmployee, b: HeadcountEmployee) => compareEmployeeId(a.id, b.id);

    return {
      status: countBy(filtered, (e) => e.status),
      salaryMode: countBy(onPayroll, (e) => e.salaryMode, (v) => v || NO_SALARY_MODE),
      bank: bankBreakdown(onPayroll),
      gender: countBy(filtered, (e) => e.gender),
      bloodGroup: countBy(filtered, (e) => e.bloodGroup),
      ageGroup: countByBand(onPayroll, (e) => e.dateOfBirth, AGE_BANDS, to),
      serviceYears: countByBand(onPayroll, (e) => e.dateOfJoining, SERVICE_BANDS, to),
      branch: countBy(onPayroll, (e) => e.branch),
      seniorByAge: withAge.filter((r) => r.years >= SENIOR_AGE).sort((a, b) => byId(a.e, b.e)),
      seniorByService: withService
        .filter((r) => r.years >= LONG_SERVICE_YEARS)
        .sort((a, b) => byId(a.e, b.e)),
      attendance: attendanceRows,
      unmarked,
      joined: filtered.filter((e) => inWindow(e.dateOfJoining, from, to)).sort(byId),
      left: filtered.filter((e) => inWindow(e.relievingDate, from, to)).sort(byId),
    };
  }, [filtered, attendanceByEmployee, windowDays]);

  const set = <K extends keyof Filters>(key: K) => (value: Filter) =>
    setFilters((f) => ({ ...f, [key]: value }));
  // Clicking the value that is already selected clears it again.
  const toggle = <K extends keyof Filters>(key: K) => (value: string) =>
    setFilters((f) => ({ ...f, [key]: f[key] === value ? null : value }));

  const anyFilter = Object.values(filters).some((v) => v !== null);
  const statusLabel = filters.status === null ? "All" : labelOf(filters.status);
  const scopeText = [
    `Status=${statusLabel}`,
    `Department=${filters.department === null ? "All" : cleanDepartment(filters.department) || "Not set"}`,
    filters.reason !== null && `Reason for Exit=${labelOf(filters.reason)}`,
    filters.marital !== null && `Marital Status=${labelOf(filters.marital)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  // `attendanceDate` is "yesterday" as the Frappe site defines it, whatever
  // the browser's clock says — the same day the ATS main dashboard shows.
  const attendanceLabel = attendanceDate
    ? `Yesterday · ${fmtDate(attendanceDate)}`
    : "No attendance date available";

  return (
    <div className="hc-page">
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
            <h2>By Head ({statusLabel})</h2>
          </header>
          <div className="hc-hero-number">{fmtInt(filtered.length)}</div>
          <p className="hc-hero-sub">
            employees on record
            {anyFilter && <> · of {fmtInt(employees.length)} total</>}
          </p>
          <h3 className="hc-subhead">By Status wise</h3>
          <SplitMeter rows={view.status} active={filters.status} onPick={toggle("status")} />
          <h3 className="hc-subhead hc-subhead-gap">
            By Gender, {statusLabel}
          </h3>
          <SplitMeter rows={view.gender} />
        </section>

        {/* ── Salary Payment Mode ─────────────────────────────────────── */}
        <section className="hc-card load-in load-in-2">
          <header>
            <h2>Salary Payment Mode (Active)</h2>
            <span className="hc-tag">Mode</span>
          </header>
          <SplitMeter rows={view.salaryMode} />
        </section>

        <section className="hc-card hc-span-2 load-in load-in-2">
          <header>
            <h2>Salary Payment Mode (Active)</h2>
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

        {/* ── Senior employees by age / service + Branch headcount ─────── */}
        <section className="hc-card hc-people-card load-in load-in-5">
          <header>
            <h2>Senior Employees (Age {SENIOR_AGE}+)</h2>
            <span className="hc-count hc-count-neutral">{fmtInt(view.seniorByAge.length)}</span>
          </header>
          <PeopleList
            people={view.seniorByAge.map((r) => r.e)}
            dateOf={(e) => e.dateOfBirth}
            detailOf={(e) => `${yearsBetween(e.dateOfBirth, today())} years old`}
            empty={`No active employee is ${SENIOR_AGE} or older.`}
          />
        </section>

        <section className="hc-card hc-people-card load-in load-in-5">
          <header>
            <h2>Senior Employees (Service {LONG_SERVICE_YEARS}+ years)</h2>
            <span className="hc-count hc-count-neutral">{fmtInt(view.seniorByService.length)}</span>
          </header>
          <PeopleList
            people={view.seniorByService.map((r) => r.e)}
            dateOf={(e) => e.dateOfJoining}
            detailOf={(e) => `${yearsBetween(e.dateOfJoining, today())} years of service`}
            empty={`No active employee has served ${LONG_SERVICE_YEARS} years yet.`}
          />
        </section>

        <section className="hc-card hc-span-2 load-in load-in-5">
          <header>
            <h2>Branch Wise Head Count (Active)</h2>
            <span className="hc-tag">Branch</span>
          </header>
          <RankedBars rows={view.branch} initial={view.branch.length} color="var(--hc-plum)" />
        </section>

        {/* ── Blood group / Age group / Years of service ───────────────── */}
        <section className="hc-card hc-span-2 load-in load-in-6">
          <header>
            <h2>Blood Group Wise Head Count ({statusLabel})</h2>
            <span className="hc-tag">Blood group</span>
          </header>
          <RankedBars rows={view.bloodGroup} initial={view.bloodGroup.length} color="var(--hc-red)" />
        </section>

        <section className="hc-card hc-span-2 load-in load-in-6">
          <header>
            <h2>Age Group Wise Head Count (Active)</h2>
            <span className="hc-tag">Age</span>
          </header>
          <RankedBars rows={view.ageGroup} initial={view.ageGroup.length} color="var(--hc-gold)" />
        </section>

        <section className="hc-card hc-span-2 load-in load-in-6">
          <header>
            <h2>Service Years Wise Head Count (Active)</h2>
            <span className="hc-tag">Service</span>
          </header>
          <RankedBars rows={view.serviceYears} initial={view.serviceYears.length} color="var(--hc-green)" />
        </section>
      </div>
    </div>
  );
}
