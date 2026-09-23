import { useEffect, useMemo, useState } from "react";
import type { Employee, EmployeeStatus } from "../../data/employeeData";
import { DEFAULT_ATTENDANCE_WINDOW, type AttendanceWindow } from "../../data/attendanceRange";
import { marksForDays } from "../../api/attendanceMarks";
import { useAttendanceMarks } from "../../hooks/useAttendanceMarks";
import { colorForIndex } from "./empPalette";
import { AttendanceRangeFilter } from "./AttendanceRangeFilter";
import { AttendanceSparkline } from "./AttendanceSparkline";
import { EmployeeAvatar } from "./EmployeeAvatar";

const STATUS_LABEL: Record<EmployeeStatus, string> = {
  active: "Active",
  "on-leave": "On leave",
  exited: "Exited",
};

const STATUS_FILTERS: { key: EmployeeStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "on-leave", label: "On leave" },
  { key: "exited", label: "Exited" },
];

/**
 * Rows rendered per "Show more". The roster is ~2.3k people and each row
 * carries up to 30 dots, so rendering everything at once (~70k nodes) locked
 * up the tab. Paging also bounds the attendance query to what's on screen.
 */
const PAGE_SIZE = 50;

function formatJoinDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export function EmployeeDirectory({ employees, departments }: { employees: Employee[]; departments: string[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<EmployeeStatus | "all">("all");
  const [department, setDepartment] = useState("all");
  const [windowDays, setWindowDays] = useState<AttendanceWindow>(DEFAULT_ATTENDANCE_WINDOW);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Ascending by employee number; `numeric` keeps "999" before "1001".
  const sorted = useMemo(
    () => [...employees].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })),
    [employees],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sorted.filter((e) => {
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (department !== "all" && e.department !== department) return false;
      if (
        q &&
        !e.name.toLowerCase().includes(q) &&
        !e.role.toLowerCase().includes(q) &&
        !e.id.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [sorted, query, statusFilter, department]);

  // Any filter change starts back at the first page.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, statusFilter, department]);

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const visibleIds = useMemo(() => visible.map((e) => e.id), [visible]);
  const attendance = useAttendanceMarks(visibleIds, windowDays);

  return (
    <div className="emp-panel load-in">
      <div className="emp-panel-title">Directory</div>
      <div className="emp-panel-sub">{filtered.length} of {employees.length} people</div>

      <div className="emp-toolbar" style={{ marginBottom: 16 }}>
        <label className="emp-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search name, role or number…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search employees"
          />
        </label>

        <select
          className="emp-select"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          aria-label="Filter by department"
        >
          <option value="all">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      <div className="emp-chips" style={{ marginBottom: 14 }}>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`emp-chip${statusFilter === f.key ? " active" : ""}`}
            onClick={() => setStatusFilter(f.key)}
            aria-pressed={statusFilter === f.key}
          >
            {f.label}
          </button>
        ))}
      </div>

      <AttendanceRangeFilter
        windowDays={windowDays}
        resolved={attendance.resolved}
        loading={attendance.loading}
        onChange={setWindowDays}
      />
      {attendance.error && (
        <div className="emp-range-error">Couldn't load attendance: {attendance.error}</div>
      )}

      <div className="emp-directory-list">
        {filtered.length === 0 && <div className="emp-empty">No one matches those filters.</div>}
        {visible.map((e) => {
          const deptIndex = departments.indexOf(e.department);
          return (
            <div className="emp-row" key={e.id}>
              <EmployeeAvatar employee={e} color={colorForIndex(deptIndex)} />
              <div className="emp-row-main">
                <div className="emp-row-name">{e.name} - {e.id}</div>
                <div className="emp-row-role">
                  {e.role} · {e.department}
                </div>
                <AttendanceSparkline
                  marks={marksForDays(attendance.marks.get(e.id), attendance.resolved.days)}
                  days={attendance.resolved.days}
                  label={attendance.resolved.label}
                />
              </div>
              <div className="emp-row-tags">
                <span className={`emp-status-tag ${e.status}`}>{STATUS_LABEL[e.status]}</span>
                <span className="emp-row-join">joined {formatJoinDate(e.joinDate)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {visible.length < filtered.length && (
        <div className="emp-show-more">
          <button
            type="button"
            className="emp-chip"
            onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
          >
            Show {Math.min(PAGE_SIZE, filtered.length - visible.length)} more
          </button>
          <span className="emp-range-label">
            {visible.length} of {filtered.length} shown
          </span>
        </div>
      )}
    </div>
  );
}
