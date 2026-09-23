import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { GratuityReport } from "../../data/employeeData";
import { cleanDepartment } from "../../api/frappeMappers";

/** Departments listed before "Show all". */
const COLLAPSED_COUNT = 6;

interface DepartmentRow {
  id: string;
  label: string;
  people: number;
  total: number;
  consumed: number;
  remaining: number;
}

/** Exact amount, grouped by thousands — never rounded to k/M. */
function fmtAmount(v: number): string {
  return Math.round(v).toLocaleString("en-US");
}

function pctOf(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

export function GratuityPanel({ report }: { report: GratuityReport | null }) {
  const [showAll, setShowAll] = useState(false);

  const departments = useMemo(() => {
    const byDept = new Map<string, DepartmentRow>();
    for (const r of report?.records ?? []) {
      // Grouped on the raw Frappe name, as the report's own chart is, so two
      // departments never merge after the company suffix is stripped.
      const row = byDept.get(r.department) ?? {
        id: r.department,
        label: cleanDepartment(r.department),
        people: 0,
        total: 0,
        consumed: 0,
        remaining: 0,
      };
      row.people += 1;
      row.total += r.total;
      row.consumed += r.consumed;
      row.remaining += r.remaining;
      byDept.set(r.department, row);
    }
    return [...byDept.values()].sort((a, b) => b.total - a.total);
  }, [report]);

  if (!report) {
    return (
      <div className="emp-grat">
        <div className="emp-empty">
          The ATS gratuity report could not be loaded, so no figures are shown.
        </div>
      </div>
    );
  }

  const { totals } = report;

  if (totals.employees === 0) {
    return (
      <div className="emp-grat">
        <div className="emp-empty">The ATS gratuity report returned no employees.</div>
      </div>
    );
  }

  const consumedWidth = totals.total > 0 ? (totals.consumed / totals.total) * 100 : 0;
  const visible = showAll ? departments : departments.slice(0, COLLAPSED_COUNT);
  const maxDept = Math.max(0, ...departments.map((d) => d.total));

  return (
    <div className="emp-grat">
      <div className="emp-grat-stats">
        <div className="emp-grat-stat">
          <div className="emp-grat-stat-label">Employees</div>
          <div className="emp-grat-stat-value">{totals.employees.toLocaleString("en-US")}</div>
          <div className="emp-grat-stat-sub">in the report</div>
        </div>
        <div className="emp-grat-stat">
          <div className="emp-grat-stat-label">Total gratuity</div>
          <div className="emp-grat-stat-value">{fmtAmount(totals.total)}</div>
          <div className="emp-grat-stat-sub">PKR</div>
        </div>
        <div className="emp-grat-stat">
          <div className="emp-grat-stat-label">Consumed</div>
          <div className="emp-grat-stat-value">{fmtAmount(totals.consumed)}</div>
          <div className="emp-grat-stat-sub">PKR · {totals.consumedPct}% of total</div>
        </div>
        <div className="emp-grat-stat">
          <div className="emp-grat-stat-label">Remaining</div>
          <div className="emp-grat-stat-value">{fmtAmount(totals.remaining)}</div>
          <div className="emp-grat-stat-sub">PKR</div>
        </div>
      </div>

      <div
        className="emp-grat-balance"
        role="img"
        aria-label={`PKR ${fmtAmount(totals.consumed)} consumed, PKR ${fmtAmount(totals.remaining)} remaining`}
      >
        <div className="emp-grat-track">
          <span className="emp-grat-fill consumed" style={{ width: `${consumedWidth}%` }} />
          <span className="emp-grat-fill remaining" style={{ width: `${100 - consumedWidth}%` }} />
        </div>
        <div className="emp-grat-balance-keys">
          <span className="emp-grat-key consumed">Consumed</span>
          <span className="emp-grat-key remaining">Remaining</span>
        </div>
      </div>

      <div className="emp-grat-bands">
        <div className="emp-grat-bands-title">By department · {departments.length}</div>
        {visible.map((d) => {
          const width = maxDept > 0 ? (d.total / maxDept) * 100 : 0;
          const drawn = d.total > 0 ? (d.consumed / d.total) * 100 : 0;
          return (
            <div
              className="emp-grat-band"
              key={d.id}
              title={`${d.id}: PKR ${fmtAmount(d.total)} total · PKR ${fmtAmount(d.consumed)} consumed · PKR ${fmtAmount(d.remaining)} remaining`}
            >
              <div className="emp-grat-band-head">
                <span className="emp-grat-band-label">{d.label}</span>
                <span className="emp-grat-band-people">{d.people.toLocaleString("en-US")} people</span>
                <span className="emp-grat-band-value">{fmtAmount(d.total)}</span>
              </div>
              <div className="emp-grat-band-track">
                <span className="emp-grat-band-bar" style={{ width: `${width}%` }}>
                  <span className="emp-grat-fill consumed" style={{ width: `${drawn}%` }} />
                  <span className="emp-grat-fill remaining" style={{ width: `${100 - drawn}%` }} />
                </span>
                <span className="emp-grat-band-pct">{pctOf(d.consumed, d.total)}% consumed</span>
              </div>
            </div>
          );
        })}
        {departments.length > COLLAPSED_COUNT && (
          <button type="button" className="emp-grat-more" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show fewer" : `Show all ${departments.length} departments`}
          </button>
        )}
      </div>

      <Link to="/gratuity-report" className="emp-grat-details">
        View details — every employee →
      </Link>

      <div className="emp-grat-note">Source: ATS report “Gratuity of Employee”. Amounts in PKR.</div>
    </div>
  );
}
