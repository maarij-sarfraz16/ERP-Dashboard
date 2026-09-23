import "../styles/employees.css";
import { PageLoader } from "../components/common/PageLoader";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { GratuityRecord } from "../data/employeeData";
import { useGratuityReport } from "../hooks/useGratuityReport";
import { cleanDepartment, compareEmployeeId } from "../api/frappeMappers";
import { PageHead } from "../components/common/PageHead";

type SortKey = "employeeId" | "employeeName" | "department" | "total" | "consumed" | "remaining" | "consumedPct";

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "employeeId", label: "Employee ID", numeric: false },
  { key: "employeeName", label: "Employee Name", numeric: false },
  { key: "department", label: "Department", numeric: false },
  { key: "total", label: "Total Gratuity", numeric: true },
  { key: "consumed", label: "Consumed Gratuity", numeric: true },
  { key: "remaining", label: "Remaining Gratuity", numeric: true },
  { key: "consumedPct", label: "Consumed %", numeric: true },
];

/** Exact rupee amount with paisa, as the ATS desk shows it. */
function fmtRs(v: number): string {
  return `Rs ${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(v: number): string {
  return `${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`;
}

function compare(a: GratuityRecord, b: GratuityRecord, key: SortKey): number {
  const x = a[key];
  const y = b[key];
  if (typeof x === "number" && typeof y === "number") return x - y;
  return String(x).localeCompare(String(y), undefined, { numeric: true });
}

export function GratuityReportPage() {
  const { report, loading } = useGratuityReport();
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("all");
  // null orders by employee id, like every list in the app.
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);

  const records = report?.records;

  const departments = useMemo(
    () => [...new Set((records ?? []).map((r) => r.department))].sort(),
    [records],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = (records ?? []).filter((r) => {
      if (department !== "all" && r.department !== department) return false;
      if (q && !r.employeeName.toLowerCase().includes(q) && !r.employeeId.toLowerCase().includes(q)) return false;
      return true;
    });
    return [...filtered].sort((a, b) =>
      sort
        ? compare(a, b, sort.key) * sort.dir || compareEmployeeId(a.employeeId, b.employeeId)
        : compareEmployeeId(a.employeeId, b.employeeId),
    );
  }, [records, query, department, sort]);

  const shownTotals = useMemo(() => {
    const total = rows.reduce((s, r) => s + r.total, 0);
    const consumed = rows.reduce((s, r) => s + r.consumed, 0);
    const remaining = rows.reduce((s, r) => s + r.remaining, 0);
    return { total, consumed, remaining, pct: total > 0 ? (consumed / total) * 100 : 0 };
  }, [rows]);

  // Click cycles: first direction (largest first for amounts) → reversed → employee id order.
  function toggleSort(key: SortKey, numeric: boolean) {
    const first = numeric ? -1 : 1;
    setSort((s) => {
      if (!s || s.key !== key) return { key, dir: first };
      if (s.dir === first) return { key, dir: -first as 1 | -1 };
      return null;
    });
  }

  const head = (
    <>
      <Link to="/employees" className="emp-grat-back">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to Employees
      </Link>
      <PageHead index="04 / 04" title="Gratuity Report" subtitle="Gratuity earned and consumed, per employee — ATS Synthetic" />
    </>
  );

  if (loading) {
    return (
      <div className="employees-page">
        {head}
        <PageLoader message="Loading gratuity report…" />
      </div>
    );
  }

  if (!report || !records) {
    return (
      <div className="employees-page">
        {head}
        <div className="emp-panel">
          <div className="emp-empty">The ATS gratuity report could not be loaded, so no figures are shown.</div>
        </div>
      </div>
    );
  }

  const { totals } = report;
  const filtering = rows.length !== records.length;

  return (
    <div className="employees-page">
      {head}

      <div className="emp-panel load-in grat-report-summary">
        <div className="grat-report-stat">
          <div className="emp-grat-stat-label">Total employees</div>
          <div className="grat-report-value">{totals.employees.toLocaleString("en-US")}</div>
        </div>
        <div className="grat-report-stat">
          <div className="emp-grat-stat-label">Total gratuity</div>
          <div className="grat-report-value">{fmtRs(totals.total)}</div>
        </div>
        <div className="grat-report-stat">
          <div className="emp-grat-stat-label">Consumed gratuity</div>
          <div className="grat-report-value consumed">{fmtRs(totals.consumed)}</div>
        </div>
        <div className="grat-report-stat">
          <div className="emp-grat-stat-label">Remaining gratuity</div>
          <div className="grat-report-value remaining">{fmtRs(totals.remaining)}</div>
        </div>
        <div className="grat-report-stat">
          <div className="emp-grat-stat-label">Consumed %</div>
          <div className="grat-report-value">{fmtPct(totals.consumedPct)}</div>
        </div>
      </div>

      <div className="emp-panel load-in">
        <div className="emp-panel-title">All employees</div>
        <div className="emp-panel-sub">
          {rows.length.toLocaleString("en-US")} of {records.length.toLocaleString("en-US")} employees
        </div>

        <div className="emp-toolbar" style={{ marginBottom: 16 }}>
          <label className="emp-search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search name or employee ID…"
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
              <option key={d} value={d}>
                {d || "Unassigned"}
              </option>
            ))}
          </select>
        </div>

        <div className="grat-report-table-wrap">
          <table className="grat-report-table">
            <thead>
              <tr>
                <th className="num">#</th>
                {COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    className={c.numeric ? "num" : undefined}
                    aria-sort={sort?.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
                  >
                    <button type="button" onClick={() => toggleSort(c.key, c.numeric)}>
                      {c.label}
                      <span className="grat-report-sort">
                        {sort?.key === c.key ? (sort.dir === 1 ? "▲" : "▼") : ""}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.employeeId}>
                  <td className="num muted">{i + 1}</td>
                  <td className="num">{r.employeeId}</td>
                  <td className="name">{r.employeeName}</td>
                  <td title={r.department}>{cleanDepartment(r.department)}</td>
                  <td className="num">{fmtRs(r.total)}</td>
                  <td className="num">{fmtRs(r.consumed)}</td>
                  <td className="num">{fmtRs(r.remaining)}</td>
                  <td className="num">{fmtPct(r.consumedPct)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="emp-empty">
                    No employees match these filters.
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr>
                  <td />
                  <td colSpan={3}>{filtering ? "Total (filtered)" : "Grand Total"}</td>
                  <td className="num">{fmtRs(filtering ? shownTotals.total : totals.total)}</td>
                  <td className="num">{fmtRs(filtering ? shownTotals.consumed : totals.consumed)}</td>
                  <td className="num">{fmtRs(filtering ? shownTotals.remaining : totals.remaining)}</td>
                  <td className="num">
                    {fmtPct(filtering ? Math.round(shownTotals.pct) : totals.consumedPct)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
