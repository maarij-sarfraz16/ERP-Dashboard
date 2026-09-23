// Gratuity comes from the ATS custom script report "Gratuity of Employee"
// (module "Overtime In Salary") — the same report behind the gratuity figures
// on the ATS desk. The standard HRMS `Gratuity` doctype is empty on this
// site, so it is deliberately not used.
//
// The report decides who is eligible and how much each person has earned and
// drawn; this module only reads its rows. It never estimates or back-fills.

import { callMethod } from "./frappeClient";
import { toNumber } from "./frappeMappers";
import type { GratuityRecord, GratuityReport, GratuityTotals } from "../data/employeeData";

const REPORT_NAME = "Gratuity of Employee";

interface RawGratuityRow {
  employee_id: string | null;
  employee_name: string | null;
  department: string | null;
  total_gratuity: number | string | null;
  consumed_gratuity: number | string | null;
  remaining_gratuity: number | string | null;
  consumed_percentage: number | string | null;
}

interface RawReportResult {
  result: RawGratuityRow[];
}

/** The report appends a "Grand Total" row that has no employee id. */
function isTotalRow(row: RawGratuityRow): boolean {
  return !(row.employee_id ?? "").trim();
}

export async function fetchGratuityReport(): Promise<GratuityReport> {
  const report = await callMethod<RawReportResult>("frappe.desk.query_report.run", {
    report_name: REPORT_NAME,
    filters: {},
  });
  const rows = report?.result ?? [];

  const records: GratuityRecord[] = rows
    .filter((row) => !isTotalRow(row))
    .map((row) => ({
      employeeId: (row.employee_id ?? "").trim(),
      employeeName: row.employee_name?.trim() || (row.employee_id ?? "").trim(),
      department: row.department?.trim() || "",
      total: toNumber(row.total_gratuity),
      consumed: toNumber(row.consumed_gratuity),
      remaining: toNumber(row.remaining_gratuity),
      consumedPct: toNumber(row.consumed_percentage),
    }));

  const summed = {
    total: records.reduce((s, r) => s + r.total, 0),
    consumed: records.reduce((s, r) => s + r.consumed, 0),
    remaining: records.reduce((s, r) => s + r.remaining, 0),
  };

  // Prefer the report's own Grand Total so the headline matches ATS exactly.
  const grand = rows.find(isTotalRow);
  const totals: GratuityTotals = grand
    ? {
        employees: records.length,
        total: toNumber(grand.total_gratuity),
        consumed: toNumber(grand.consumed_gratuity),
        remaining: toNumber(grand.remaining_gratuity),
        consumedPct: toNumber(grand.consumed_percentage),
      }
    : {
        employees: records.length,
        ...summed,
        consumedPct: summed.total > 0 ? Math.round((summed.consumed / summed.total) * 100) : 0,
      };

  if (
    grand &&
    (Math.abs(totals.total - summed.total) > 1 || Math.abs(totals.consumed - summed.consumed) > 1)
  ) {
    console.warn("[frappe] Gratuity report Grand Total does not match the sum of its rows", {
      grand: totals,
      summed,
    });
  }

  return { totals, records };
}
