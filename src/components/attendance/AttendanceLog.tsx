import { useEffect, useMemo, useState } from "react";
import type { AttendanceStatus, CheckIn } from "../../data/mockData";
import { useAttendanceLog } from "../../hooks/useAttendanceLog";
import { AttendanceStatusBadge } from "../common/StatusBadge";
import { compareEmployeeId, isoDaysAgo, today } from "../../api/frappeMappers";

type StatusFilter = AttendanceStatus | "all";
type SortKey = "id" | "name" | "present" | "status" | "check-in";

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "on-time", label: "On time" },
  { key: "late", label: "Late" },
  { key: "half-day", label: "Half day" },
  { key: "absent", label: "Absent" },
  { key: "holiday", label: "Holiday" },
];

/** Absent first, then late, then on-time — the rows that need attention rise. */
const STATUS_RANK: Record<AttendanceStatus, number> = {
  absent: 0,
  late: 1,
  "half-day": 2,
  "on-time": 3,
  holiday: 4,
};

/** On-time first, then late, half-day, absent — present people lead the log. */
const PRESENT_RANK: Record<AttendanceStatus, number> = {
  "on-time": 0,
  late: 1,
  "half-day": 2,
  absent: 3,
  holiday: 4,
};

const PAGE_SIZE = 50;

function formatLongDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return isoDaysAgo(0, d);
}

export function AttendanceLog({ initialDate }: { initialDate: string | null }) {
  const [date, setDate] = useState<string>(initialDate ?? isoDaysAgo(1));
  const { log, loading, error } = useAttendanceLog(date);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [department, setDepartment] = useState("all");
  const [shift, setShift] = useState("all");
  const [sort, setSort] = useState<SortKey>("id");
  const [page, setPage] = useState(0);

  const rows: CheckIn[] = log?.rows ?? [];

  const departments = useMemo(
    () => [...new Set(rows.map((r) => r.department))].sort((a, b) => a.localeCompare(b)),
    [rows],
  );
  const shifts = useMemo(
    () => [...new Set(rows.map((r) => r.shift))].sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  // Counts on the status chips respect the other filters, so "Absent (41)"
  // means 41 absences in the chosen department/shift, not plant-wide.
  const scoped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (department !== "all" && r.department !== department) return false;
      if (shift !== "all" && r.shift !== shift) return false;
      if (q && !r.employeeName.toLowerCase().includes(q) && !r.employeeId.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, query, department, shift]);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = {
      all: scoped.length,
      "on-time": 0,
      late: 0,
      "half-day": 0,
      absent: 0,
      holiday: 0,
    };
    for (const r of scoped) {
      c[r.status] += 1;
      // "Late" is the ATS "Late Entry" card: the flag on any status, so a
      // flagged Absent row counts here as well as under Absent.
      if (r.lateEntry && r.status !== "late") c.late += 1;
    }
    return c;
  }, [scoped]);

  const filtered = useMemo(() => {
    const list =
      status === "all"
        ? scoped
        : status === "late"
          ? scoped.filter((r) => r.status === "late" || r.lateEntry)
          : scoped.filter((r) => r.status === status);
    const sorted = [...list];
    // Every order falls back to employee id, so ties are stable across days.
    const byId = (a: CheckIn, b: CheckIn) => compareEmployeeId(a.employeeId, b.employeeId);
    switch (sort) {
      case "id":
        sorted.sort(byId);
        break;
      case "name":
        sorted.sort((a, b) => a.employeeName.localeCompare(b.employeeName) || byId(a, b));
        break;
      case "present":
        sorted.sort((a, b) => PRESENT_RANK[a.status] - PRESENT_RANK[b.status] || byId(a, b));
        break;
      case "status":
        sorted.sort(
          (a, b) =>
            STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
            b.minutesLate - a.minutesLate ||
            byId(a, b),
        );
        break;
      case "check-in":
        // Rows without a check-in time go to the bottom.
        sorted.sort((a, b) => {
          if (a.checkIn === "—" && b.checkIn !== "—") return 1;
          if (b.checkIn === "—" && a.checkIn !== "—") return -1;
          return a.checkIn.localeCompare(b.checkIn) || byId(a, b);
        });
        break;
    }
    return sorted;
  }, [scoped, status, sort]);

  // Any filter change lands you back on the first page.
  useEffect(() => {
    setPage(0);
  }, [date, query, status, department, shift, sort]);

  // A department/shift picked on one day may not exist on another.
  useEffect(() => {
    if (department !== "all" && rows.length && !departments.includes(department)) setDepartment("all");
    if (shift !== "all" && rows.length && !shifts.includes(shift)) setShift("all");
  }, [rows, departments, shifts, department, shift]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const first = filtered.length === 0 ? 0 : page * PAGE_SIZE + 1;
  const last = Math.min(filtered.length, (page + 1) * PAGE_SIZE);

  const totalLate = rows.filter((r) => r.lateEntry).length;
  const totalAbsent = rows.filter((r) => r.status === "absent").length;
  const hasFilters = query || status !== "all" || department !== "all" || shift !== "all";

  const clearFilters = () => {
    setQuery("");
    setStatus("all");
    setDepartment("all");
    setShift("all");
  };

  return (
    <div className="card load-in load-in-2">
      <div className="chart-card-head att-log-head">
        <div>
          <div className="chart-title">Shift log · {formatLongDate(date)}</div>
          <div className="chart-sub">
            {loading && "Loading attendance…"}
            {!loading && !error && rows.length > 0 && (
              <>
                {rows.length.toLocaleString()} records · {totalLate} late · {totalAbsent} absent
              </>
            )}
            {!loading && !error && rows.length === 0 && "No attendance posted for this day"}
            {!loading && error && <span style={{ color: "var(--status-absent)" }}>{error}</span>}
          </div>
        </div>

        <div className="att-date-nav" role="group" aria-label="Attendance date">
          <button type="button" onClick={() => setDate(shiftDate(date, -1))} aria-label="Previous day">
            ‹
          </button>
          <input
            type="date"
            value={date}
            max={today()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            aria-label="Attendance date"
          />
          <button
            type="button"
            onClick={() => setDate(shiftDate(date, 1))}
            disabled={date >= today()}
            aria-label="Next day"
          >
            ›
          </button>
        </div>
      </div>

      <div className="att-toolbar">
        <label className="att-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search employee…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search employees"
          />
        </label>

        <select
          className="att-select"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          aria-label="Filter by department"
        >
          <option value="all">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        <select
          className="att-select"
          value={shift}
          onChange={(e) => setShift(e.target.value)}
          aria-label="Filter by shift"
        >
          <option value="all">All shifts</option>
          {shifts.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          className="att-select"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort by"
        >
          <option value="id">Sort: employee ID</option>
          <option value="name">Sort: name</option>
          <option value="present">Sort: present first</option>
          <option value="status">Sort: needs attention</option>
          <option value="check-in">Sort: check-in time</option>
        </select>

        {hasFilters && (
          <button type="button" className="att-clear" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      <div className="range-toggle att-status-chips" role="group" aria-label="Filter by status">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={status === f.key ? "active" : ""}
            onClick={() => setStatus(f.key)}
            aria-pressed={status === f.key}
          >
            {f.label} <span className="att-chip-count">{counts[f.key].toLocaleString()}</span>
          </button>
        ))}
      </div>

      <div className="att-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Employee</th>
              <th>Department</th>
              <th>Shift</th>
              <th>Check-in</th>
              <th>Check-out</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => {
              const rowClass =
                row.status === "absent" ? "row-flag" : row.status === "late" ? "row-warn" : "";
              return (
                <tr key={row.id} className={rowClass}>
                  <td className="cell-mono">{row.employeeId}</td>
                  <td>{row.employeeName}</td>
                  <td>{row.department}</td>
                  <td className="cell-mono">{row.shift}</td>
                  <td className="cell-mono">
                    {row.checkIn}
                    {row.status === "late" && row.minutesLate > 0 && (
                      <span style={{ color: "var(--status-late)", marginLeft: 6 }}>
                        +{row.minutesLate}m
                      </span>
                    )}
                  </td>
                  <td className="cell-mono">{row.checkOut ?? "—"}</td>
                  <td>
                    <AttendanceStatusBadge status={row.status} />
                  </td>
                </tr>
              );
            })}
            {!loading && pageRows.length === 0 && (
              <tr>
                <td colSpan={7} className="att-empty">
                  {rows.length === 0
                    ? "Nothing posted for this date — try the previous day."
                    : "No one matches those filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="att-pager">
        <span className="chart-sub">
          {first.toLocaleString()}–{last.toLocaleString()} of {filtered.length.toLocaleString()}
        </span>
        <div className="range-toggle">
          <button type="button" onClick={() => setPage(0)} disabled={page === 0}>
            «
          </button>
          <button type="button" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
            ‹
          </button>
          <button type="button" className="active" disabled>
            {page + 1} / {pageCount}
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= pageCount - 1}
          >
            ›
          </button>
          <button
            type="button"
            onClick={() => setPage(pageCount - 1)}
            disabled={page >= pageCount - 1}
          >
            »
          </button>
        </div>
      </div>
    </div>
  );
}
