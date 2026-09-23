// payroll.css supplies the shared segmented control and select styling;
// loans.css the cards, toolbar, table, pager and drawer this page reuses.
import "../styles/payroll.css";
import "../styles/loans.css";
import "../styles/expenses.css";
import { useCallback, useMemo, useState, type CSSProperties } from "react";
import type { ClaimBeneficiary, ExpenseClaimRecord } from "../data/expenseClaimData";
import { CLAIM_BENEFICIARIES } from "../data/expenseClaimData";
import { useExpenseClaims } from "../hooks/useExpenseClaims";
import { cleanDepartment } from "../api/frappeMappers";
import { PageHead } from "../components/common/PageHead";
import { SectionHeader } from "../components/common/SectionHeader";
import { Segmented } from "../components/payroll/Segmented";
import { ClaimsTimelineChart, type TimelinePoint } from "../components/expenses/ClaimsTimelineChart";
import { ExpenseClaimDrawer } from "../components/expenses/ExpenseClaimDrawer";
import { ExpenseClaimTable } from "../components/expenses/ExpenseClaimTable";
import { compareClaims, totalsOf, type SortKey, type SortState } from "../components/expenses/expenseTableModel";
import {
  BENEFICIARY_COLOR,
  fmtInt,
  fmtRs,
  orderWorkflowStates,
  titleCase,
  weekStart,
  workflowColor,
  workflowLabel,
} from "../components/expenses/expenseFormat";

const PAGE_SIZES = [25, 50, 100] as const;

const MONTH_ORDER = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type EmpStatusFilter = "all" | "Active" | "Inactive" | "Left";
type AmountBand = "all" | "lt10k" | "10k-50k" | "gt50k";

const AMOUNT_BANDS: { value: AmountBand; label: string; test: (v: number) => boolean }[] = [
  { value: "all", label: "Any amount", test: () => true },
  { value: "lt10k", label: "Under Rs 10,000", test: (v) => v < 10_000 },
  { value: "10k-50k", label: "Rs 10,000 – 50,000", test: (v) => v >= 10_000 && v <= 50_000 },
  { value: "gt50k", label: "Over Rs 50,000", test: (v) => v > 50_000 },
];

/** Where a claim sits in the workflow, for the charts' three-way split. */
function stageOf(r: ExpenseClaimRecord): "approved" | "inProcess" | "rejected" {
  if (r.docstatus === 2 || r.workflowState === "Rejected" || r.approvalStatus === "Rejected") return "rejected";
  if (r.workflowState === "Approved" || r.docstatus === 1) return "approved";
  return "inProcess";
}

interface RankedRow {
  id: string;
  label: string;
  count: number;
  claimed: number;
  approved: number;
  inProcess: number;
}

function rankBy(rows: ExpenseClaimRecord[], keyOf: (r: ExpenseClaimRecord) => string, labelOf: (id: string) => string): RankedRow[] {
  const map = new Map<string, RankedRow>();
  for (const r of rows) {
    const id = keyOf(r);
    const row = map.get(id) ?? { id, label: labelOf(id), count: 0, claimed: 0, approved: 0, inProcess: 0 };
    row.count += 1;
    row.claimed += r.totalClaimedAmount;
    const stage = stageOf(r);
    if (stage === "approved") row.approved += r.totalClaimedAmount;
    else if (stage === "inProcess") row.inProcess += r.totalClaimedAmount;
    map.set(id, row);
  }
  return [...map.values()].sort((a, b) => b.claimed - a.claimed);
}

/** Ranked bars: length = share of the largest; fill split approved vs. in process. */
function RankedBars({ rows, unit, labelWidth }: { rows: RankedRow[]; unit: string; labelWidth?: number }) {
  const max = Math.max(0, ...rows.map((d) => d.claimed));
  return (
    <div className="ln-ranked">
      {rows.map((d) => {
        const width = max > 0 ? (d.claimed / max) * 100 : 0;
        const approvedPct = d.claimed > 0 ? (d.approved / d.claimed) * 100 : 0;
        const processPct = d.claimed > 0 ? (d.inProcess / d.claimed) * 100 : 0;
        return (
          <div
            className="ln-ranked-row"
            key={d.id}
            style={labelWidth ? ({ gridTemplateColumns: `${labelWidth}px 1fr auto` } as CSSProperties) : undefined}
            title={`${d.label}: ${d.count} ${unit} · ${fmtRs(d.claimed)} claimed · ${fmtRs(d.approved)} approved · ${fmtRs(d.inProcess)} in process`}
          >
            <span className="ln-ranked-label">{d.label}</span>
            <span className="ln-ranked-track">
              <span className="ln-ranked-fill" style={{ width: `${width}%` }}>
                <span style={{ width: `${approvedPct}%`, background: "var(--data-green)" }} />
                <span style={{ width: `${processPct}%`, background: "var(--data-amber)" }} />
                <span style={{ width: `${100 - approvedPct - processPct}%`, background: "var(--data-rust)" }} />
              </span>
            </span>
            <span className="ln-ranked-value">
              <span className="ln-ranked-num">{fmtRs(d.claimed)}</span>
              <span className="ln-ranked-sub">
                {fmtInt(d.count)} {unit}
              </span>
            </span>
          </div>
        );
      })}
      {rows.length === 0 && <p className="chart-sub">Nothing matches the filters.</p>}
    </div>
  );
}

export function ExpenseClaimsPage() {
  const { data: report, loading, error } = useExpenseClaims();

  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("all");
  const [expenseType, setExpenseType] = useState("all");
  const [department, setDepartment] = useState("all");
  const [billMonth, setBillMonth] = useState("all");
  const [payment, setPayment] = useState("all");
  const [beneficiary, setBeneficiary] = useState<"all" | ClaimBeneficiary>("all");
  const [empStatus, setEmpStatus] = useState<EmpStatusFilter>("all");
  const [amountBand, setAmountBand] = useState<AmountBand>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sort, setSort] = useState<SortState | null>(null);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  // The page index is remembered together with the filter set it belongs
  // to, so any change to the filters implicitly returns to the first page.
  const filterKey = JSON.stringify([
    query, stage, expenseType, department, billMonth, payment, beneficiary, empStatus, amountBand, fromDate, toDate, sort, pageSize,
  ]);
  const [pageState, setPageState] = useState({ key: filterKey, page: 0 });
  const page = pageState.key === filterKey ? pageState.page : 0;
  const setPage = (next: number | ((p: number) => number)) =>
    setPageState({ key: filterKey, page: typeof next === "function" ? next(page) : next });
  const [openClaim, setOpenClaim] = useState<string | null>(null);

  const records = report?.records;

  const expenseTypes = useMemo(() => [...new Set((records ?? []).map((r) => r.expenseType).filter(Boolean))].sort(), [records]);
  const departments = useMemo(() => [...new Set((records ?? []).map((r) => r.department))].sort(), [records]);
  const billMonths = useMemo(
    () =>
      [...new Set((records ?? []).map((r) => r.billOfMonth).filter(Boolean))].sort(
        (a, b) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b),
      ),
    [records],
  );
  const payments = useMemo(() => [...new Set((records ?? []).map((r) => r.status).filter(Boolean))].sort(), [records]);
  const workflowStates = useMemo(() => orderWorkflowStates((records ?? []).map((r) => r.workflowState)), [records]);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of records ?? []) counts[r.workflowState] = (counts[r.workflowState] ?? 0) + 1;
    return counts;
  }, [records]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const band = AMOUNT_BANDS.find((b) => b.value === amountBand) ?? AMOUNT_BANDS[0];
    return (records ?? []).filter((r) => {
      if (stage !== "all" && r.workflowState !== stage) return false;
      if (expenseType !== "all" && r.expenseType !== expenseType) return false;
      if (department !== "all" && r.department !== department) return false;
      if (billMonth !== "all" && r.billOfMonth !== billMonth) return false;
      if (payment !== "all" && r.status !== payment) return false;
      if (beneficiary !== "all" && !(r.split ?? []).some((p) => p.beneficiary === beneficiary && p.amount > 0)) return false;
      if (empStatus !== "all" && r.employeeStatus !== empStatus) return false;
      if (!band.test(r.totalClaimedAmount)) return false;
      if (fromDate && r.postingDate < fromDate) return false;
      if (toDate && r.postingDate > toDate) return false;
      if (
        q &&
        !r.employeeName.toLowerCase().includes(q) &&
        !r.employee.toLowerCase().includes(q) &&
        !r.name.toLowerCase().includes(q) &&
        !r.designation.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [records, query, stage, expenseType, department, billMonth, payment, beneficiary, empStatus, amountBand, fromDate, toDate]);

  const sorted = useMemo(
    () => (sort ? [...filtered].sort((a, b) => compareClaims(a, b, sort.key) * sort.dir) : filtered),
    [filtered, sort],
  );

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const visibleTotals = useMemo(() => totalsOf(filtered), [filtered]);
  const filtering = records !== undefined && filtered.length !== records.length;

  // ── Chart data (all follow the filters) ──
  const timeline = useMemo<TimelinePoint[]>(() => {
    const map = new Map<string, TimelinePoint>();
    for (const r of filtered) {
      const week = weekStart(r.postingDate);
      const p = map.get(week) ?? { week, approved: 0, inProcess: 0, rejected: 0, count: 0 };
      p[stageOf(r)] += r.totalClaimedAmount;
      p.count += 1;
      map.set(week, p);
    }
    return [...map.values()].sort((a, b) => a.week.localeCompare(b.week));
  }, [filtered]);

  const byDepartment = useMemo(() => rankBy(filtered, (r) => r.department, cleanDepartment), [filtered]);
  const byType = useMemo(() => rankBy(filtered, (r) => r.expenseType, (id) => (id ? titleCase(id) : "Untyped")), [filtered]);

  const byBeneficiary = useMemo(() => {
    const map = new Map<string, { lines: number; amount: number; claims: number }>();
    for (const r of filtered) {
      for (const p of r.split ?? []) {
        const id = p.beneficiary || "";
        const row = map.get(id) ?? { lines: 0, amount: 0, claims: 0 };
        row.lines += p.lines;
        row.amount += p.amount;
        row.claims += 1;
        map.set(id, row);
      }
    }
    const order: (ClaimBeneficiary | "")[] = [...CLAIM_BENEFICIARIES, ""];
    return order
      .filter((b) => map.has(b))
      .map((b) => ({ id: b, label: b || "Unspecified", ...map.get(b)! }));
  }, [filtered]);
  const beneficiaryTotal = byBeneficiary.reduce((s, b) => s + b.amount, 0);

  const pipeline = useMemo(
    () =>
      workflowStates
        .map((s) => {
          const rows = filtered.filter((r) => r.workflowState === s);
          return { state: s, count: rows.length, amount: rows.reduce((t, r) => t + r.totalClaimedAmount, 0) };
        })
        .filter((s) => s.count > 0),
    [filtered, workflowStates],
  );

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
    setStage("all");
    setExpenseType("all");
    setDepartment("all");
    setBillMonth("all");
    setPayment("all");
    setBeneficiary("all");
    setEmpStatus("all");
    setAmountBand("all");
    setFromDate("");
    setToDate("");
  }

  const closeDrawer = useCallback(() => setOpenClaim(null), []);
  const openRecord = openClaim ? (records ?? []).find((r) => r.name === openClaim) ?? null : null;

  const head = (
    <PageHead index="07 / 07" title="Expense Claims" subtitle="Medical and expense reimbursements, approvals and payouts — ATS Synthetic" />
  );

  if (loading) {
    return (
      <div className="ln-page ec-page">
        {head}
        <p className="chart-sub">Reading every Expense Claim from Frappe…</p>
      </div>
    );
  }

  if (!report || !records) {
    return (
      <div className="ln-page ec-page">
        {head}
        <div className="ln-card ln-error">
          <div className="chart-title">Expense claims could not be loaded</div>
          <p className="chart-sub" style={{ marginTop: 6 }}>
            {error ?? "No response from Frappe."} No figures are shown until they load.
          </p>
        </div>
      </div>
    );
  }

  // ── Summary (over every claim, not the filters) ──
  const employees = new Set(records.map((r) => r.employee)).size;
  const claimed = records.reduce((s, r) => s + r.totalClaimedAmount, 0);
  const sanctioned = records.reduce((s, r) => s + r.totalSanctionedAmount, 0);
  const reimbursed = records.reduce((s, r) => s + r.totalAmountReimbursed, 0);
  const paidCount = records.filter((r) => r.isPaid || r.status === "Paid").length;
  const awaiting = records.filter((r) => stageOf(r) === "inProcess");
  const awaitingAmount = awaiting.reduce((s, r) => s + r.totalClaimedAmount, 0);
  const payable = records.filter((r) => r.docstatus === 1 && r.status === "Unpaid");
  const payableAmount = payable.reduce((s, r) => s + r.totalSanctionedAmount - r.totalAmountReimbursed, 0);
  const rejected = records.filter((r) => stageOf(r) === "rejected").length;

  const tiles: { label: string; value: string; foot: string; accent: string }[] = [
    {
      label: "Total Claims",
      value: fmtInt(records.length),
      foot: `${fmtInt(employees)} employees${rejected > 0 ? ` · ${fmtInt(rejected)} rejected or cancelled` : ""}`,
      accent: "var(--data-indigo)",
    },
    { label: "Total Claimed", value: fmtRs(claimed), foot: `across ${fmtInt(records.length)} claims`, accent: "var(--data-indigo)" },
    {
      label: "Total Sanctioned",
      value: fmtRs(sanctioned),
      foot: claimed > 0 ? `${((sanctioned / claimed) * 100).toFixed(2)}% of claimed` : "—",
      accent: "var(--data-green)",
    },
    {
      label: "Awaiting Approval",
      value: fmtInt(awaiting.length),
      foot: `${fmtRs(awaitingAmount)} in the workflow`,
      accent: "var(--data-amber)",
    },
    {
      label: "Approved, Unpaid",
      value: fmtRs(payableAmount),
      foot: `${fmtInt(payable.length)} claims to reimburse`,
      accent: "var(--data-rust)",
    },
    {
      label: "Reimbursed",
      value: fmtRs(reimbursed),
      foot: `${fmtInt(paidCount)} claims paid out`,
      accent: "var(--data-green)",
    },
  ];

  const stageOptions = [
    { value: "all", label: "All", count: records.length },
    ...workflowStates
      .filter((s) => stageCounts[s] !== undefined)
      .map((s) => ({ value: s, label: workflowLabel(s), count: stageCounts[s], color: workflowColor(s) })),
  ];

  const pipelineTotal = pipeline.reduce((s, p) => s + p.count, 0);

  return (
    <div className="ln-page ec-page">
      {head}

      {records.length === 0 ? (
        <div className="ln-card">
          <div className="chart-title">No expense claims</div>
          <p className="chart-sub" style={{ marginTop: 6 }}>
            The Expense Claim list is empty on this site.
          </p>
        </div>
      ) : (
        <>
          <SectionHeader index="01" title="Summary" />
          <div className="ln-stats ec-stats">
            {tiles.map((t, i) => (
              <div
                key={t.label}
                className={`ln-stat load-in load-in-${Math.min(i + 1, 4)}`}
                style={{ "--ln-accent": t.accent } as CSSProperties}
              >
                <div className="ln-stat-label">{t.label}</div>
                <div className="ln-stat-value" title={t.value}>
                  {t.value}
                </div>
                <div className="ln-stat-foot">{t.foot}</div>
              </div>
            ))}
          </div>

          <SectionHeader index="02" title="Where the money is" />
          <div className="ln-grid ec-grid">
            <div className="ln-card load-in">
              <div className="ln-card-head">
                <div>
                  <div className="chart-title">Claims by posting week</div>
                  <p className="chart-sub">
                    Amount claimed per week, by where each claim is in the workflow ·{" "}
                    {filtering ? "claims matching the filters below" : "all claims"}
                  </p>
                </div>
                <div className="ec-legend">
                  <span className="ln-key">
                    <span className="ln-key-dot" style={{ background: "var(--data-green)" }} />
                    <span className="ln-key-label">Approved</span>
                  </span>
                  <span className="ln-key">
                    <span className="ln-key-dot" style={{ background: "var(--data-amber)" }} />
                    <span className="ln-key-label">In process</span>
                  </span>
                  <span className="ln-key">
                    <span className="ln-key-dot" style={{ background: "var(--data-rust)" }} />
                    <span className="ln-key-label">Rejected</span>
                  </span>
                </div>
              </div>
              {timeline.length > 0 ? <ClaimsTimelineChart points={timeline} /> : <p className="chart-sub">Nothing matches the filters.</p>}

              <div className="ln-card-head" style={{ marginTop: 22 }}>
                <div>
                  <div className="chart-title">By department</div>
                  <p className="chart-sub">Amount claimed · {byDepartment.length} departments</p>
                </div>
              </div>
              <RankedBars rows={byDepartment} unit="claims" />
            </div>

            <div className="ln-card load-in load-in-2">
              <div className="ln-card-head">
                <div>
                  <div className="chart-title">Approval pipeline</div>
                  <p className="chart-sub">Claims at each workflow state</p>
                </div>
              </div>
              {pipeline.length > 0 ? (
                <>
                  <div className="ln-meter ec-pipeline" role="img" aria-label="Claims by workflow state">
                    {pipeline.map((p) => (
                      <span
                        key={p.state}
                        style={{ width: `${(p.count / pipelineTotal) * 100}%`, background: workflowColor(p.state) }}
                        title={`${workflowLabel(p.state)}: ${fmtInt(p.count)} claims · ${fmtRs(p.amount)}`}
                      />
                    ))}
                  </div>
                  <div className="ec-pipeline-keys">
                    {pipeline.map((p) => (
                      <button
                        type="button"
                        key={p.state}
                        className={`ec-pipeline-key${stage === p.state ? " active" : ""}`}
                        onClick={() => setStage(stage === p.state ? "all" : p.state)}
                        title="Filter the table to this state"
                      >
                        <span className="ln-key-dot" style={{ background: workflowColor(p.state) }} />
                        <span className="ec-pipeline-state">{workflowLabel(p.state)}</span>
                        <span className="ec-pipeline-count">{fmtInt(p.count)}</span>
                        <span className="ec-pipeline-amt">{fmtRs(p.amount)}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="chart-sub">Nothing matches the filters.</p>
              )}

              <div className="ln-card-head" style={{ marginTop: 22 }}>
                <div>
                  <div className="chart-title">By expense type</div>
                  <p className="chart-sub">Amount claimed per claim-level type</p>
                </div>
              </div>
              <RankedBars rows={byType} unit="claims" labelWidth={130} />

              {report.joins.lines && (
                <>
                  <div className="ln-card-head" style={{ marginTop: 22 }}>
                    <div>
                      <div className="chart-title">Who the bills were for</div>
                      <p className="chart-sub">Expense lines by beneficiary · {fmtRs(beneficiaryTotal)}</p>
                    </div>
                  </div>
                  {byBeneficiary.length > 0 ? (
                    <>
                      <div className="ln-meter" role="img" aria-label="Amount by beneficiary">
                        {byBeneficiary.map((b) => (
                          <span
                            key={b.id}
                            style={{
                              width: `${beneficiaryTotal > 0 ? (b.amount / beneficiaryTotal) * 100 : 0}%`,
                              background: BENEFICIARY_COLOR[b.id],
                            }}
                          />
                        ))}
                      </div>
                      <div className="ec-benef-grid">
                        {byBeneficiary.map((b) => (
                          <button
                            type="button"
                            key={b.id}
                            className={`ec-benef-tile${beneficiary === b.id ? " active" : ""}`}
                            onClick={() => (b.id ? setBeneficiary(beneficiary === b.id ? "all" : b.id) : undefined)}
                            disabled={!b.id}
                            title={b.id ? "Filter the table to claims with lines for this person" : undefined}
                          >
                            <span className="ec-benef-name">
                              <span className="ln-key-dot" style={{ background: BENEFICIARY_COLOR[b.id] }} />
                              {b.label}
                            </span>
                            <span className="ec-benef-amt">{fmtRs(b.amount)}</span>
                            <span className="ec-benef-sub">
                              {beneficiaryTotal > 0 ? `${((b.amount / beneficiaryTotal) * 100).toFixed(1)}%` : "—"} ·{" "}
                              {fmtInt(b.lines)} lines · {fmtInt(b.claims)} claims
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="chart-sub">Nothing matches the filters.</p>
                  )}
                </>
              )}
            </div>
          </div>

          <SectionHeader index="03" title="All claims" />
          <div className="ln-card load-in">
            <div className="ln-toolbar">
              <Segmented value={stage} options={stageOptions} onChange={setStage} label="Workflow state" />
              <label className="ln-search">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Search name, employee ID, claim ID or designation…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search expense claims"
                />
              </label>
              <span className="ln-count">
                {fmtInt(filtered.length)} of {fmtInt(records.length)} claims
              </span>
            </div>

            <div className="ln-toolbar">
              <label className="py-select">
                <span>Type</span>
                <select value={expenseType} onChange={(e) => setExpenseType(e.target.value)} aria-label="Filter by expense type">
                  <option value="all">All</option>
                  {expenseTypes.map((t) => (
                    <option key={t} value={t}>
                      {titleCase(t)}
                    </option>
                  ))}
                </select>
              </label>
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
                <span>Bill month</span>
                <select value={billMonth} onChange={(e) => setBillMonth(e.target.value)} aria-label="Filter by bill month">
                  <option value="all">All</option>
                  {billMonths.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label className="py-select">
                <span>Payment</span>
                <select value={payment} onChange={(e) => setPayment(e.target.value)} aria-label="Filter by payment status">
                  <option value="all">All</option>
                  {payments.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              {report.joins.lines && (
                <label className="py-select">
                  <span>For</span>
                  <select
                    value={beneficiary}
                    onChange={(e) => setBeneficiary(e.target.value as "all" | ClaimBeneficiary)}
                    aria-label="Filter by beneficiary"
                  >
                    <option value="all">Anyone</option>
                    {CLAIM_BENEFICIARIES.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="py-select">
                <span>Amount</span>
                <select value={amountBand} onChange={(e) => setAmountBand(e.target.value as AmountBand)} aria-label="Filter by claimed amount">
                  {AMOUNT_BANDS.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
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
                <span>Posted from</span>
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} aria-label="Posted from" />
              </label>
              <label className="ln-date">
                <span>to</span>
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} aria-label="Posted to" />
              </label>
              {filtering && (
                <button type="button" className="ln-clear" onClick={clearFilters}>
                  Clear filters
                </button>
              )}
            </div>

            <ExpenseClaimTable
              rows={pageRows}
              offset={safePage * pageSize}
              sort={sort}
              onSort={toggleSort}
              onOpen={setOpenClaim}
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
                    <button key={n} type="button" className={pageSize === n ? "active" : undefined} onClick={() => setPageSize(n)}>
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

      {openRecord && <ExpenseClaimDrawer record={openRecord} onClose={closeDrawer} />}
    </div>
  );
}
