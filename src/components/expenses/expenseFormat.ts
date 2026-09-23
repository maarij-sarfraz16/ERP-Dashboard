import type { ClaimBeneficiary } from "../../data/expenseClaimData";

export { fmtDate, fmtInt, fmtRs, fmtRsTick } from "../loans/loanFormat";

/**
 * Workflow states in process order. Unknown states (a workflow edit on the
 * site) are appended after these, in the order they are first seen.
 */
export const WORKFLOW_ORDER = ["Pending", "forward to Auditor", "Review", "Approved", "Rejected"];

export function orderWorkflowStates(seen: Iterable<string>): string[] {
  const extra = [...new Set(seen)].filter((s) => !WORKFLOW_ORDER.includes(s)).sort();
  return [...WORKFLOW_ORDER, ...extra];
}

/** Display label: the site's state names are lower-case in places. */
export function workflowLabel(state: string): string {
  if (!state) return "—";
  return state.charAt(0).toUpperCase() + state.slice(1);
}

/** Colour per workflow state, for the pipeline bar and the segmented control. */
export function workflowColor(state: string): string {
  switch (state) {
    case "Approved":
      return "var(--data-green)";
    case "Rejected":
      return "var(--data-rust)";
    case "Review":
    case "forward to Auditor":
      return "var(--data-indigo)";
    case "Pending":
      return "var(--data-amber)";
    default:
      return "var(--ink-muted)";
  }
}

/** Pill class per workflow state. */
export function workflowPillClass(state: string): string {
  switch (state) {
    case "Approved":
      return "done";
    case "Rejected":
      return "absent";
    case "Review":
    case "forward to Auditor":
      return "info";
    case "Pending":
      return "processing";
    default:
      return "pending";
  }
}

/** Pill class per `Expense Claim.status` (payment status). */
export function statusPillClass(status: string): string {
  switch (status) {
    case "Paid":
      return "done";
    case "Unpaid":
      return "processing";
    case "Rejected":
    case "Cancelled":
      return "absent";
    case "Submitted":
      return "info";
    default:
      return "pending";
  }
}

export const BENEFICIARY_COLOR: Record<ClaimBeneficiary | "", string> = {
  Self: "var(--data-indigo)",
  Wife: "var(--data-rust)",
  Son: "var(--data-green)",
  Daughter: "var(--data-amber)",
  "": "var(--ink-muted)",
};

/** "MEDICAL (PRODUCTION)" → "Medical (Production)". */
export function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s(])(\p{L})/gu, (m) => m.toUpperCase());
}

/** Monday of the ISO week containing `iso`, as an ISO date. */
export function weekStart(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const shift = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - shift);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mm}-${dd}`;
}
