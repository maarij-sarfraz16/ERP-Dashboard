import type { LoanStatus } from "../../data/loanData";

/** Exact rupee amount, never rounded to k/M; paisa shown only when present. */
export function fmtRs(v: number): string {
  const hasPaisa = Math.abs(v - Math.round(v)) >= 0.005;
  return `Rs ${v.toLocaleString("en-US", {
    minimumFractionDigits: hasPaisa ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

/** Axis ticks: "6.8M", "750k" — the tooltip carries the exact figure. */
export function fmtRsTick(v: number): string {
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toLocaleString("en-US", { maximumFractionDigits: 1 })}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toLocaleString("en-US", { maximumFractionDigits: 0 })}k`;
  return v.toLocaleString("en-US");
}

export function fmtInt(v: number): string {
  return v.toLocaleString("en-US");
}

/** `2026-07-01` → `01 Jul 2026`; null → em dash. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Status order as declared on `HR Loan.status`. */
export const LOAN_STATUSES: LoanStatus[] = ["Sanctioned", "Disbursed", "Closed", "Cancelled"];

/** Pill class per status, mirroring the report's own colour mapping. */
export function statusPillClass(status: string): string {
  switch (status) {
    case "Disbursed":
      return "info";
    case "Closed":
      return "done";
    case "Sanctioned":
      return "processing";
    case "Cancelled":
      return "absent";
    default:
      return "pending";
  }
}
