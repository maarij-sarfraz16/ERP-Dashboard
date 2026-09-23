import type { EmploymentType } from "../../data/mockData";

// Payroll figures are never rounded: dividing by a million keeps every rupee
// (and paisa) as decimals, so "Rs 165.137563 M" is exactly Rs 165,137,563.
const EXACT = { maximumFractionDigits: 8 } as const;

/** Exact figure in millions from Rs 1M up, full rupees below that. */
export function formatRs(v: number): string {
  if (Math.abs(v) >= 1e6) return `Rs ${(v / 1e6).toLocaleString("en-US", EXACT)} M`;
  return `Rs ${v.toLocaleString("en-US", EXACT)}`;
}

/** Axis ticks and bar labels: "165.137563M", "850,000". Exact, like `formatRs`. */
export function formatRsTick(v: number): string {
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toLocaleString("en-US", EXACT)}M`;
  return v.toLocaleString("en-US", EXACT);
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
