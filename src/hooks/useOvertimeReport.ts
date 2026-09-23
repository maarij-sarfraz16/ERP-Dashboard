import { useMemo } from "react";
import type { OvertimeReport } from "../data/employeeData";
import { fetchOvertimeReport } from "../api/overtimeApi";
import { useLiveData, type LiveDataState } from "./useLiveData";

/**
 * Overtime read from Salary Slip / Attendance. Shared by the Attendance page
 * (logged hours, department split) and Payroll (paid hours by month).
 *
 * `month` scopes the headline tiles and department split; `null` means the
 * current month. Changing it re-reads Frappe — the previous month's figures
 * stay on screen until the new ones arrive.
 */
export function useOvertimeReport(month: string | null = null): LiveDataState<OvertimeReport> {
  // `useLiveData` reloads whenever its fetcher changes identity, so a new
  // month is a new fetcher.
  const fetcher = useMemo(() => () => fetchOvertimeReport(month), [month]);
  return useLiveData(fetcher);
}
