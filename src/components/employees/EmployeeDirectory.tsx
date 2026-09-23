import { useMemo, useState } from "react";
import type { Employee, EmployeeStatus } from "../../data/employeeData";
import { colorForIndex } from "./empPalette";
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

function formatJoinDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export function EmployeeDirectory({ employees, departments }: { employees: Employee[]; departments: string[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<EmployeeStatus | "all">("all");
  const [department, setDepartment] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter((e) => {
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (department !== "all" && e.department !== department) return false;
      if (q && !e.name.toLowerCase().includes(q) && !e.role.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [employees, query, statusFilter, department]);

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
            placeholder="Search name or role…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search employees"
          />
        </label>

        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          aria-label="Filter by department"
          style={{
            fontFamily: "var(--emp-font-body)",
            fontSize: 13,
            padding: "7px 10px",
            borderRadius: 8,
            border: "1px solid var(--emp-line)",
            background: "var(--emp-paper-raised)",
            color: "var(--emp-ink)",
          }}
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

      <div className="emp-directory-list">
        {filtered.length === 0 && <div className="emp-empty">No one matches those filters.</div>}
        {filtered.map((e) => {
          const deptIndex = departments.indexOf(e.department);
          return (
            <div className="emp-row" key={e.id}>
              <EmployeeAvatar employee={e} color={colorForIndex(deptIndex)} />
              <div>
                <div className="emp-row-name">{e.name}</div>
                <div className="emp-row-role">
                  {e.role} · {e.department}
                </div>
              </div>
              <div className="emp-row-tags">
                <span className={`emp-status-tag ${e.status}`}>{STATUS_LABEL[e.status]}</span>
                <span className="emp-row-join">joined {formatJoinDate(e.joinDate)}</span>
                <AttendanceSparkline marks={e.attendance14d} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
