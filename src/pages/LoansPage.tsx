// payroll.css supplies the shared segmented control and select styling.
import "../styles/payroll.css";
import { PageLoader } from "../components/common/PageLoader";
import "../styles/loans.css";
import { useCallback, useMemo, useState, type CSSProperties } from "react";
import type { LoanSummaryCard } from "../data/loanData";
import { useLoanReport } from "../hooks/useLoanReport";
import { cleanDepartment, compareEmployeeId } from "../api/frappeMappers";
import { PageHead } from "../components/common/PageHead";
import { SectionHeader } from "../components/common/SectionHeader";
import { Segmented } from "../components/payroll/Segmented";
import { TopBalancesChart } from "../components/loans/TopBalancesChart";
import { LoanDetailDrawer } from "../components/loans/LoanDetailDrawer";
import { LoanTable } from "../components/loans/LoanTable";
import { compareLoans, totalsOf, type SortKey, type SortState } from "../components/loans/loanTableModel";
import { fmtInt, fmtRs, LOAN_STATUSES } from "../components/loans/loanFormat";

const PAGE_SIZES = [25, 50, 100] as const;

type StatusFilter = "all" | string;
type EmpStatusFilter = "all" | "Active" | "Inactive" | "Left";

/** Accent per summary card, keyed on the indicator the report assigns. */
const INDICATOR_ACCENT: Record<string, string> = {
  blue: "var(--data-indigo)",
  green: "var(--data-green)",
  red: "var(--data-rust)",
  orange: "var(--data-amber)",
  grey: "var(--ink-muted)",
};

function cardValue(card: LoanSummaryCard): string {
  return card.datatype === "Currency" ? fmtRs(card.value) : fmtInt(card.value);
}

function findCard(summary: LoanSummaryCard[] | null, label: string): LoanSummaryCard | undefined {
  return summary?.find((c) => c.label === label);
}

export function LoansPage() {
  const { data: report, loading, error } = useLoanReport();

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [department, setDepartment] = useState("all");
  const [source, setSource] = useState("all");
  const [loanType, setLoanType] = useState("all");
  const [empStatus, setEmpStatus] = useState<EmpStatusFilter>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sort, setSort] = useState<SortState | null>(null);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  // The page index is remembered together with the filter set it belongs
  // to, so any change to the filters implicitly returns to the first page.
  const filterKey = JSON.stringify([query, status, department, source, loanType, empStatus, fromDate, toDate, sort, pageSize]);
  const [pageState, setPageState] = useState({ key: filterKey, page: 0 });
  const page = pageState.key === filterKey ? pageState.page : 0;
  const setPage = (next: number | ((p: number) => number)) =>
    setPageState({ key: filterKey, page: typeof next === "function" ? next(page) : next });
  const [openLoan, setOpenLoan] = useState<string | null>(null);

  const records = report?.records;

  const departments = useMemo(
    () => [...new Set((records ?? []).map((r) => r.department))].sort(),
    [records],
  );
  // The report's chart only carries employee names; look their IDs up from the rows.
  const employeeIdsByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of records ?? []) {
      const key = r.employeeName.trim().toUpperCase();
      if (!map.has(key)) map.set(key, r.employee);
    }
    return map;
  }, [records]);
  const sources = useMemo(
    () => [...new Set((records ?? []).map((r) => r.loanSource).filter(Boolean))].sort(),
    [records],
  );
  const loanTypes = useMemo(
    () => [...new Set((records ?? []).map((r) => r.loanType).filter(Boolean))].sort(),
    [records],
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of records ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1;
    return counts;
  }, [records]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (records ?? []).filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (department !== "all" && r.department !== department) return false;
      if (source !== "all" && r.loanSource !== source) return false;
      if (loanType !== "all" && r.loanType !== loanType) return false;
      if (empStatus !== "all" && r.employeeStatus !== empStatus) return false;
      if (fromDate && (!r.disbursementDate || r.disbursementDate < fromDate)) return false;
      if (toDate && (!r.disbursementDate || r.disbursementDate > toDate)) return false;
      if (
        q &&
        !r.employeeName.toLowerCase().includes(q) &&
        !r.employee.toLowerCase().includes(q) &&
        !r.loan.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [records, query, status, department, source, loanType, empStatus, fromDate, toDate]);

  // No column chosen → ascending by employee id, like every list in the app.
  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) =>
        sort
          ? compareLoans(a, b, sort.key) * sort.dir || compareEmployeeId(a.employee, b.employee)
          : compareEmployeeId(a.employee, b.employee),
      ),
    [filtered, sort],
  );

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const visibleTotals = useMemo(() => totalsOf(filtered), [filtered]);
  const filtering = records !== undefined && filtered.length !== records.length;

  const byDepartment = useMemo(() => {
    const map = new Map<string, { id: string; count: number; paid: number; balance: number; amount: number }>();
    for (const r of filtered) {
      const row = map.get(r.department) ?? { id: r.department, count: 0, paid: 0, balance: 0, amount: 0 };
      row.count += 1;
      row.paid += r.totalAmountPaid;
      row.balance += r.balanceAmount;
      row.amount += r.loanAmount;
      map.set(r.department, row);
    }
    return [...map.values()].sort((a, b) => b.amount - a.amount);
  }, [filtered]);

  function toggleSort(key: SortKey, numeric: boolean) {
    const first = numeric ? -1 : 1;
    setSort((s) => {
      if (!s || s.key !== key) return { key, dir: first };
      if (s.dir === first) return { key, dir: -first as 1 | -1 };
      return null;
    });
  }

  function clearFilters() {
    setQuery("");
    setStatus("all");
    setDepartment("all");
    setSource("all");
    setLoanType("all");
    setEmpStatus("all");
    setFromDate("");
    setToDate("");
  }

  const closeDrawer = useCallback(() => setOpenLoan(null), []);
  const openRecord = openLoan ? (records ?? []).find((r) => r.loan === openLoan) ?? null : null;

  const head = <PageHead title="Loans" subtitle="Employee loans, repayments and outstanding balances — ATS Synthetic" />;

  if (loading) {
    return (
      <div className="ln-page">
        {head}
        <PageLoader message="Loading loan summary…" />
      </div>
    );
  }

  if (!report || !records) {
    return (
      <div className="ln-page">
        {head}
        <div className="ln-card ln-error">
          <div className="chart-title">The HR Loan Summary report could not be loaded</div>
          <p className="chart-sub" style={{ marginTop: 6 }}>
            {error ?? "No response from Frappe."} No loan figures are shown until it loads.
          </p>
        </div>
      </div>
    );
  }

  const { summary, chart } = report;
  const recovered = findCard(summary, "Total Amount Recovered");
  const outstanding = findCard(summary, "Total Outstanding Balance");
  const totalAmount = findCard(summary, "Total Loan Amount");
  const recoveredPct =
    recovered && totalAmount && totalAmount.value > 0 ? (recovered.value / totalAmount.value) * 100 : 0;
  const maxDeptAmount = Math.max(0, ...byDepartment.map((d) => d.amount));

  const statusOptions = [
    { value: "all" as StatusFilter, label: "All", count: records.length },
    ...LOAN_STATUSES.filter((s) => statusCounts[s] !== undefined || s === "Disbursed" || s === "Closed").map((s) => ({
      value: s as StatusFilter,
      label: s,
      count: statusCounts[s] ?? 0,
    })),
  ];

  return (
    <div className="ln-page">
      {head}

      {records.length === 0 ? (
        <div className="ln-card">
          <div className="chart-title">No loans</div>
          <p className="chart-sub" style={{ marginTop: 6 }}>
            The HR Loan Summary report returned no loan records.
          </p>
        </div>
      ) : (
        <>
          <SectionHeader index="01" title="Summary" />
          {summary && summary.length > 0 && (
            <div className="ln-stats">
              {summary.map((card, i) => (
                <div
                  key={card.label}
                  className={`ln-stat load-in load-in-${Math.min(i + 1, 4)}`}
                  style={{ "--ln-accent": INDICATOR_ACCENT[card.indicator] ?? "var(--ink-muted)" } as CSSProperties}
                >
                  <div className="ln-stat-label">{card.label}</div>
                  <div className="ln-stat-value" title={cardValue(card)}>
                    {cardValue(card)}
                  </div>
                  <div className="ln-stat-foot">
                    {card.label === "Total Amount Recovered" && totalAmount
                      ? `${recoveredPct.toFixed(2)}% of total loan amount`
                      : card.label === "Total Outstanding Balance" && totalAmount
                        ? `${(100 - recoveredPct).toFixed(2)}% of total loan amount`
                        : card.datatype === "Int"
                          ? `of ${fmtInt(records.length)} loans`
                          : `across ${fmtInt(records.length)} loans`}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="ln-grid">
            <div className="ln-card load-in">
              <div className="ln-card-head">
                <div>
                  <div className="chart-title">{chart?.title || "Top employees by outstanding balance"}</div>
                  <p className="chart-sub">Ranked by balance remaining, as the ATS report ranks them</p>
                </div>
              </div>
              {chart ? (
                <TopBalancesChart chart={chart} employeeIds={employeeIdsByName} />
              ) : (
                <p className="chart-sub">The report returned no chart.</p>
              )}
            </div>

            <div className="ln-card load-in load-in-2">
              <div className="ln-card-head">
                <div>
                  <div className="chart-title">Recovery</div>
                  <p className="chart-sub">Recovered against balance, all loans</p>
                </div>
              </div>
              {recovered && outstanding ? (
                <>
                  <div
                    className="ln-meter"
                    role="img"
                    aria-label={`${fmtRs(recovered.value)} recovered, ${fmtRs(outstanding.value)} balance`}
                  >
                    <span style={{ width: `${recoveredPct}%`, background: "var(--data-green)" }} />
                    <span style={{ width: `${100 - recoveredPct}%`, background: "var(--data-rust)" }} />
                  </div>
                  <div className="ln-meter-keys">
                    <span className="ln-key">
                      <span className="ln-key-dot" style={{ background: "var(--data-green)" }} />
                      <span className="ln-key-value">{fmtRs(recovered.value)}</span>
                      <span className="ln-key-label">recovered</span>
                    </span>
                    <span className="ln-key">
                      <span className="ln-key-dot" style={{ background: "var(--data-rust)" }} />
                      <span className="ln-key-value">{fmtRs(outstanding.value)}</span>
                      <span className="ln-key-label">balance</span>
                    </span>
                  </div>
                </>
              ) : (
                <p className="chart-sub">The report returned no summary.</p>
              )}

              <div className="ln-card-head" style={{ marginTop: 22 }}>
                <div>
                  <div className="chart-title">By department</div>
                  <p className="chart-sub">
                    Recovered vs. balance · {filtering ? "loans matching the filters below" : "all loans"} ·{" "}
                    {byDepartment.length} departments
                  </p>
                </div>
              </div>
              <div className="ln-ranked">
                {byDepartment.map((d) => {
                  // Bar length = share of the biggest lender; the split inside it is recovered vs. balance.
                  const width = maxDeptAmount > 0 ? (d.amount / maxDeptAmount) * 100 : 0;
                  const paidPct = d.amount > 0 ? Math.min(100, (d.paid / d.amount) * 100) : 0;
                  return (
                    <div
                      className="ln-ranked-row"
                      key={d.id}
                      title={`${d.id}: ${d.count} loans · ${fmtRs(d.amount)} lent · ${fmtRs(d.paid)} recovered · ${fmtRs(d.balance)} balance`}
                    >
                      <span className="ln-ranked-label">{cleanDepartment(d.id)}</span>
                      <span className="ln-ranked-track">
                        <span className="ln-ranked-fill" style={{ width: `${width}%` }}>
                          <span style={{ width: `${paidPct}%`, background: "var(--data-green)" }} />
                          <span style={{ width: `${100 - paidPct}%`, background: "var(--data-rust)" }} />
                        </span>
                      </span>
                      <span className="ln-ranked-value">
                        <span className="ln-ranked-num green">{fmtRs(d.paid)}</span>
                        <span className="ln-ranked-sep">/</span>
                        <span className="ln-ranked-num rust">{fmtRs(d.balance)}</span>
                        <span className="ln-ranked-sub">{d.count} loans</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <SectionHeader index="02" title="All loans" />
          <div className="ln-card load-in">
            <div className="ln-toolbar">
              <Segmented value={status} options={statusOptions} onChange={setStatus} label="Loan status" />
              <label className="ln-search">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Search name, employee ID or loan ID…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search loans"
                />
              </label>
              <span className="ln-count">
                {fmtInt(filtered.length)} of {fmtInt(records.length)} loans
              </span>
            </div>

            <div className="ln-toolbar">
              <label className="py-select">
                <span>Department</span>
                <select value={department} onChange={(e) => setDepartment(e.target.value)} aria-label="Filter by department">
                  <option value="all">All</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {cleanDepartment(d)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="py-select">
                <span>Source</span>
                <select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Filter by repayment source">
                  <option value="all">All</option>
                  {sources.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="py-select">
                <span>Loan type</span>
                <select value={loanType} onChange={(e) => setLoanType(e.target.value)} aria-label="Filter by loan type">
                  <option value="all">All</option>
                  {loanTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              {report.joins.employeeStatus && (
                <label className="py-select">
                  <span>Employee</span>
                  <select
                    value={empStatus}
                    onChange={(e) => setEmpStatus(e.target.value as EmpStatusFilter)}
                    aria-label="Filter by employee status"
                  >
                    <option value="all">Any status</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Left">Left</option>
                  </select>
                </label>
              )}
              <label className="ln-date">
                <span>Disbursed from</span>
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} aria-label="Disbursed from" />
              </label>
              <label className="ln-date">
                <span>to</span>
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} aria-label="Disbursed to" />
              </label>
              {filtering && (
                <button type="button" className="ln-clear" onClick={clearFilters}>
                  Clear filters
                </button>
              )}
            </div>

            <LoanTable
              rows={pageRows}
              offset={safePage * pageSize}
              sort={sort}
              onSort={toggleSort}
              onOpen={setOpenLoan}
              footer={visibleTotals}
              footerLabel={filtering ? "Total (filtered)" : "Grand Total"}
            />

            <div className="ln-pager">
              <span>
                {sorted.length === 0
                  ? "No rows"
                  : `Rows ${fmtInt(safePage * pageSize + 1)}–${fmtInt(Math.min(sorted.length, (safePage + 1) * pageSize))} of ${fmtInt(sorted.length)}`}
              </span>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div className="range-toggle" role="group" aria-label="Rows per page">
                  {PAGE_SIZES.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={pageSize === n ? "active" : undefined}
                      onClick={() => setPageSize(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="range-toggle" role="group" aria-label="Page">
                  <button type="button" onClick={() => setPage(0)} disabled={safePage === 0}>
                    «
                  </button>
                  <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0}>
                    ‹
                  </button>
                  <button type="button" className="active">
                    {safePage + 1} / {pageCount}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                    disabled={safePage >= pageCount - 1}
                  >
                    ›
                  </button>
                  <button type="button" onClick={() => setPage(pageCount - 1)} disabled={safePage >= pageCount - 1}>
                    »
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {openRecord && <LoanDetailDrawer record={openRecord} onClose={closeDrawer} />}
    </div>
  );
}
