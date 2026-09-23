// Reconciliation: this dashboard vs. the ATS main dashboard (the Frappe
// "Overview" workspace), against the LIVE site in `.env`.
//
//   npm test
//
// It fails on ANY difference — not just the headline totals, but the set of
// employee ids behind them — so two wrong datasets that happen to add up to
// the same number still fail. Every "main dashboard" figure here is obtained
// the way the desk obtains it (the Number Card document evaluated by
// `number_card.get_result`) or straight from `frappe.client.get_list` with the
// card's own stored filters; nothing on that side goes through this app's
// adapters.

import { describe, expect, it } from "vitest";
import { callMethod, getDoc, getList } from "./frappeClient";
import { ATTENDANCE_CARDS } from "./attendanceDay";
import { fetchDailyAttendance } from "./attendanceCommon";
import { fetchAttendanceLog } from "./attendanceLogApi";
import { fetchWorkforceData } from "./workforceApi";
import { fetchEmployeeData } from "./employeeApi";
import { isoDaysAgo } from "./frappeMappers";

type Filter = [string, string, string, unknown, boolean?];

interface NumberCardDoc {
  name: string;
  filters_json: string;
  dynamic_filters_json: string | null;
}

/** The Number Card exactly as stored in Frappe. */
async function card(name: string): Promise<NumberCardDoc> {
  return getDoc<NumberCardDoc>("Number Card", name);
}

/** What the desk widget shows for a card: the server evaluates it. */
async function cardValue(doc: NumberCardDoc, filters: Filter[]): Promise<number> {
  const result = await callMethod<number | string>(
    "frappe.desk.doctype.number_card.number_card.get_result",
    { doc, filters },
  );
  return Number(result);
}

/** The card's stored filters, optionally with its "yesterday" pinned to a date. */
function cardFilters(doc: NumberCardDoc, pinDate?: string): Filter[] {
  const filters = JSON.parse(doc.filters_json) as Filter[];
  if (!pinDate) return filters;
  return filters.map((f) =>
    f[1] === "attendance_date" && f[2] === "Timespan" ? [f[0], f[1], "=", pinDate] : f,
  );
}

/** Employee ids of the rows a card counts, via `get_list` with its own filters. */
async function cardEmployeeIds(doc: NumberCardDoc, pinDate?: string): Promise<string[]> {
  const rows = await getList<{ employee: string }>("Attendance", {
    // Frappe's list API takes [field, op, value] triplets; the card stores
    // [doctype, field, op, value, hidden].
    filters: cardFilters(doc, pinDate).map((f) => [f[1], f[2], f[3]]),
    fields: ["employee"],
    limit: 0,
  });
  return rows.map((r) => r.employee).sort();
}

/** The calendar date the server resolves "yesterday" to. */
async function serverYesterday(): Promise<string> {
  const rows = await getList<{ attendance_date: string }>("Attendance", {
    fields: ["attendance_date"],
    filters: [["attendance_date", "Timespan", "yesterday"]],
    groupBy: "attendance_date",
    limit: 0,
  });
  expect(rows.length, "server 'yesterday' resolved to more than one date").toBeLessThanOrEqual(1);
  return rows[0]?.attendance_date ?? "";
}

describe("yesterday: this dashboard vs. the ATS Overview workspace", () => {
  it("Overview tiles equal the Number Cards, for the same date", async () => {
    const [absentCard, presentCard, lateCard, workforce] = await Promise.all([
      card(ATTENDANCE_CARDS.absent),
      card(ATTENDANCE_CARDS.present),
      card(ATTENDANCE_CARDS.late),
      fetchWorkforceData(),
    ]);
    for (const c of [absentCard, presentCard, lateCard]) {
      expect(JSON.parse(c.dynamic_filters_json || "[]"), `${c.name} has dynamic filters`).toEqual([]);
    }
    const [mainAbsent, mainPresent, mainLate, yesterday] = await Promise.all([
      cardValue(absentCard, cardFilters(absentCard)),
      cardValue(presentCard, cardFilters(presentCard)),
      cardValue(lateCard, cardFilters(lateCard)),
      serverYesterday(),
    ]);

    const { kpis } = workforce;
    console.log(
      `[reconcile] yesterday=${yesterday || kpis.attendanceDate} ` +
        `main: absent=${mainAbsent} present=${mainPresent} late=${mainLate} | ` +
        `app: absent=${kpis.absentToday} present=${kpis.presentToday} late=${kpis.lateToday} ` +
        `(${kpis.attendanceRecordsPosted} rows posted of ${kpis.totalEmployees} active)`,
    );
    // The date under the tiles must be the server's "yesterday" (when that
    // day has rows the server can tell us the date it resolved to).
    if (yesterday) expect(kpis.attendanceDate).toBe(yesterday);
    expect(workforce.latestPostedDate).toBe(kpis.attendanceDate);

    expect({ absent: kpis.absentToday, present: kpis.presentToday, late: kpis.lateToday }).toEqual({
      absent: mainAbsent,
      present: mainPresent,
      late: mainLate,
    });

    // The attendance trend bar for the same day must say the same thing as
    // the cards — it is computed from a separate aggregate query, so it can
    // only agree if it uses the cards' definitions.
    const bar = workforce.attendanceDaily.find((p) => p.date === kpis.attendanceDate);
    expect(bar, `no trend bar for ${kpis.attendanceDate}`).toBeDefined();
    expect({ absent: bar!.absent, present: bar!.present, late: bar!.late }).toEqual({
      absent: mainAbsent,
      present: mainPresent,
      late: mainLate,
    });
  });

  it("the absent employee ids are the same set on both dashboards", async () => {
    const absentCard = await card(ATTENDANCE_CARDS.absent);
    const [mainIds, workforce, employees] = await Promise.all([
      cardEmployeeIds(absentCard),
      fetchWorkforceData(),
      fetchEmployeeData(),
    ]);
    const date = workforce.kpis.attendanceDate;
    expect(date).toBeTruthy();

    // What this app's per-day reads return for the day the tiles describe.
    const appRows = await getList<{ employee: string }>("Attendance", {
      fields: ["employee"],
      filters: [
        ["attendance_date", "=", date],
        ["docstatus", "=", 1],
        ["status", "=", "Absent"],
      ],
      limit: 0,
    });
    const appIds = appRows.map((r) => r.employee).sort();

    // Employees page's Workforce snapshot: the per-employee status map it filters on.
    expect(employees.attendanceDate).toBe(date);
    const snapshotIds: string[] = [];
    for (const [id, statuses] of employees.attendanceByEmployee) {
      for (const s of statuses) if (s === "Absent") snapshotIds.push(id);
    }
    snapshotIds.sort();

    console.log(
      `[reconcile] ${date} absent ids: main=${mainIds.length} app=${appIds.length} snapshot=${snapshotIds.length}`,
    );
    // Sorted arrays, not Sets: a duplicated row shows up as a length change.
    expect(appIds).toEqual(mainIds);
    expect(snapshotIds).toEqual(mainIds);
    expect(workforce.kpis.absentToday).toBe(mainIds.length);
  });

  it("the Employees page describes the same day and figures as the tiles", async () => {
    const [workforce, employees] = await Promise.all([fetchWorkforceData(), fetchEmployeeData()]);
    const { kpis } = workforce;
    expect(employees.presenceDate).toBe(kpis.attendanceDate);
    expect(employees.attendanceDate).toBe(kpis.attendanceDate);
    expect(employees.totalActive).toBe(kpis.totalEmployees);
    expect(employees.presentTodayPct).toBe(
      kpis.totalEmployees > 0 ? Math.round((kpis.presentToday / kpis.totalEmployees) * 100) : 0,
    );
  });
});

describe("other dates: the app's per-day reads vs. the cards pinned to that date", () => {
  // Today (normally unposted), yesterday, and the six days before it.
  const dates = Array.from({ length: 8 }, (_, i) => isoDaysAgo(i));

  it.each(dates)("%s", async (date) => {
    const absentCard = await card(ATTENDANCE_CARDS.absent);
    const presentCard = await card(ATTENDANCE_CARDS.present);
    const [mainAbsent, mainPresent, mainAbsentIds, trendRows, log] = await Promise.all([
      cardValue(absentCard, cardFilters(absentCard, date)),
      cardValue(presentCard, cardFilters(presentCard, date)),
      cardEmployeeIds(absentCard, date),
      // The grouped rows behind the trend charts.
      fetchDailyAttendance(date),
      // The per-row read behind the daily shift log.
      fetchAttendanceLog(date),
    ]);

    const trendAbsent = trendRows
      .filter((r) => r.attendance_date === date && r.status === "Absent")
      .reduce((n, r) => n + Number(r.count), 0);
    const trendPresent = trendRows
      .filter((r) => r.attendance_date === date && r.status === "Present")
      .reduce((n, r) => n + Number(r.count), 0);

    console.log(
      `[reconcile] ${date} main: absent=${mainAbsent} present=${mainPresent} ids=${mainAbsentIds.length} | ` +
        `app trend: absent=${trendAbsent} present=${trendPresent} | log rows=${log.rows.length}`,
    );
    expect(trendAbsent).toBe(mainAbsent);
    expect(trendPresent).toBe(mainPresent);
    expect(mainAbsentIds.length).toBe(mainAbsent);

    // The log maps every non-Present/Holiday/Half Day status to "absent"
    // (e.g. "On Leave"), so it can only be >= the card; it must never be less.
    const logAbsent = log.rows.filter((r) => r.status === "absent").length;
    expect(logAbsent).toBeGreaterThanOrEqual(mainAbsent);
  });
});
