import type { EmploymentType } from "../../data/mockData";

// Payroll figures are never rounded. Every number is cut to exactly two
// decimals by dropping whatever follows (11.268 → "11.26", 11 → "11.00"),
// so "Rs 165.13 M" comes from Rs 165,137,563 without rounding up.
const EXACT = { maximumFractionDigits: 8 } as const;

/** Truncate to two decimals with grouping, never rounding: 1234.567 → "1,234.56". */
export function trunc2(v: number): string {
  const [int, frac = ""] = v.toLocaleString("en-US", EXACT).split(".");
  return `${int}.${(frac + "00").slice(0, 2)}`;
}

/** Figure in millions from Rs 1M up, full rupees below that; two decimals, truncated. */
export function formatRs(v: number): string {
  if (Math.abs(v) >= 1e6) return `Rs ${trunc2(v / 1e6)} M`;
  return `Rs ${trunc2(v)}`;
}

/** Axis ticks and bar labels: "165.13M", "850,000.00". Truncated, like `formatRs`. */
export function formatRsTick(v: number): string {
  if (Math.abs(v) >= 1e6) return `${trunc2(v / 1e6)}M`;
  return trunc2(v);
}

/** Month key `"2026-08"` → `"Aug 2026"`. */
export function formatMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

/**
 * One colour per staff group, used by every payroll chart so a group keeps its
 * colour whatever filter is applied. Same pairing as `EmploymentTypeBar`.
 */
export const CYCLE_META: Record<
  EmploymentType,
  { label: string; cycle: string; color: string; key: "permanent" | "dailyWage" }
> = {
  Permanent: {
    label: "Permanent",
    cycle: "Monthly cycle",
    color: "var(--data-indigo)",
    key: "permanent",
  },
  "Daily Wage": {
    label: "Daily wages",
    cycle: "Semi-monthly cycle",
    color: "var(--data-amber)",
    key: "dailyWage",
  },
};

export type CycleFilter = "all" | EmploymentType;

export const CYCLE_FILTERS: { value: CycleFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "Daily Wage", label: "Daily wages" },
  { value: "Permanent", label: "Permanent" },
];
