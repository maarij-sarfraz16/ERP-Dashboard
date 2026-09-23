// The one place that decides WHICH attendance day the dashboard's headline
// figures describe, and WHAT those figures are.
//
// The headline tiles must agree with the ATS "Overview" workspace in Frappe
// (the main dashboard). That workspace is built from Number Card documents,
// so instead of re-implementing their filters here, this module fetches the
// same Number Card documents and asks Frappe to evaluate them through the
// same whitelisted method the desk widget calls. Whatever the card says, the
// tile says — if HR edits a card's filters, both dashboards change together.
//
// "Yesterday" is likewise never computed in the browser. The cards filter on
// `attendance_date Timespan "yesterday"`, which Frappe resolves on the server
// against the site's own time zone (Asia/Karachi here). The date shown next
// to the figures is read back from the server the same way, so the label and
// the numbers can't refer to different days, and a browser in another time
// zone still shows the day the plant calls "yesterday".
//
// Note what this deliberately does NOT do: it does not skip a day whose
// posting is still in progress. Attendance is posted in batches through the
// following morning, so early in the day the figures are partial — exactly as
// they are on the main dashboard. `recordsPosted` is exposed so the UI can say
// so rather than silently picking an older, more complete day (which is what
// used to make the two dashboards disagree).

import { callMethod, getDoc, getList, FrappeError } from "./frappeClient";
import { toNumber } from "./frappeMappers";

/**
 * The Number Cards on the ATS "Overview" workspace that this dashboard
 * mirrors. Names are Frappe document names; the definitions live in Frappe.
 */
export const ATTENDANCE_CARDS = {
  /** `Attendance`: docstatus 1, status Absent, attendance_date yesterday. */
  absent: "Absent Yesterday",
  /** `Attendance`: docstatus 1, status Present (late or not), yesterday. */
  present: "Total Present (Yesterday)",
  /** `Attendance`: docstatus 1, late_entry 1 (any status), yesterday. */
  late: "Late Entry (Yesterday)",
} as const;

/**
 * The other headline Number Cards on the same ATS "Overview" workspace —
 * not tied to the attendance day, so they are fetched separately.
 */
export const WORKSPACE_CARDS = {
  /** `Employee Checkin`: time Timespan "today" (workspace label "Employee Checkin Today"). */
  checkinsToday: "Checkins Today",
  /** `Employee`: employment_type PERMANENT, any status (workspace label "Permanent Employee"). */
  permanent: "Employee Type Wise-1",
  /** `Employee`: employment_type DAILY WAGES, any status (workspace label "Daily Wages Employee"). */
  dailyWages: "Employee Type WIse",
} as const;

export interface WorkspaceHeadlines {
  /** WORKSPACE_CARDS.checkinsToday, as evaluated by Frappe. */
  checkinsToday: number;
  /** WORKSPACE_CARDS.permanent, as evaluated by Frappe. */
  permanentEmployees: number;
  /** WORKSPACE_CARDS.dailyWages, as evaluated by Frappe. */
  dailyWageEmployees: number;
}

export interface AttendanceDaySummary {
  /** The calendar date Frappe resolves "yesterday" to, in the site time zone. */
  date: string;
  /** ATTENDANCE_CARDS.present, as evaluated by Frappe. */
  present: number;
  /** ATTENDANCE_CARDS.absent, as evaluated by Frappe. */
  absent: number;
  /** ATTENDANCE_CARDS.late, as evaluated by Frappe. */
  late: number;
  /** Submitted Attendance rows on `date`, whatever their status. */
  recordsPosted: number;
}

interface NumberCardDoc {
  name: string;
  type: string;
  document_type: string | null;
  function: string | null;
  filters_json: string | null;
  dynamic_filters_json: string | null;
}

/**
 * Evaluates a "Document Type" Number Card exactly as the Frappe desk does:
 * the card document plus its stored filters go to
 * `number_card.get_result`, which runs the count on the server.
 *
 * Only static filters are supported. Dynamic filters are JavaScript
 * expressions the desk evaluates in the browser with the logged-in user's
 * defaults, which this app has no way to reproduce — so rather than guess and
 * silently differ from the workspace, a card that uses them is rejected.
 */
export async function evaluateNumberCard(name: string): Promise<number> {
  const doc = await getDoc<NumberCardDoc>("Number Card", name);

  if (doc.type !== "Document Type") {
    throw new FrappeError(`Number Card "${name}" is of type "${doc.type}", not "Document Type".`, {
      hint: "This dashboard can only mirror cards that count a doctype directly.",
    });
  }
  const dynamic = parseFilters(doc.dynamic_filters_json);
  if (dynamic.length > 0) {
    throw new FrappeError(`Number Card "${name}" uses dynamic filters, which cannot be evaluated outside the desk.`, {
      hint: "Replace the dynamic filter on the card with a static value, or point this dashboard at a card without one.",
    });
  }

  const result = await callMethod<number | string>(
    "frappe.desk.doctype.number_card.number_card.get_result",
    { doc, filters: parseFilters(doc.filters_json) },
  );
  return toNumber(result);
}

function parseFilters(json: string | null | undefined): unknown[] {
  if (!json) return [];
  const parsed: unknown = JSON.parse(json);
  return Array.isArray(parsed) ? parsed : [];
}

/**
 * The calendar date the server means by "yesterday", plus how many submitted
 * Attendance rows it holds. Uses the same `Timespan` filter the cards use, so
 * it is resolved by the same server code against the same clock.
 */
async function fetchServerYesterday(): Promise<{ date: string; recordsPosted: number }> {
  const rows = await getList<{ attendance_date: string; count: number | string }>("Attendance", {
    fields: ["attendance_date", "count(name) as count"],
    filters: [
      ["attendance_date", "Timespan", "yesterday"],
      ["docstatus", "=", 1],
    ],
    groupBy: "attendance_date",
    limit: 0,
  });
  if (rows.length > 0) {
    // "yesterday" is a single day, so at most one group comes back.
    return { date: rows[0].attendance_date, recordsPosted: toNumber(rows[0].count) };
  }
  // Nothing posted yet for that day — still show the right date, from the
  // site's time zone rather than the browser's.
  return { date: await yesterdayInSiteTimeZone(), recordsPosted: 0 };
}

async function yesterdayInSiteTimeZone(): Promise<string> {
  const { time_zone } = await callMethod<{ time_zone: string }>("frappe.client.get_time_zone");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: time_zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  // Date.UTC on the site-local calendar date, minus one day: no DST or
  // browser-offset arithmetic is involved.
  const yesterday = new Date(Date.UTC(get("year"), get("month") - 1, get("day") - 1));
  return yesterday.toISOString().slice(0, 10);
}

/**
 * Yesterday's headline attendance figures, straight from the ATS Number
 * Cards. This is a required read: if the cards cannot be evaluated the
 * caller should fail rather than fall back to a locally-computed figure that
 * might disagree with the main dashboard.
 */
export async function fetchAttendanceDaySummary(): Promise<AttendanceDaySummary> {
  const [{ date, recordsPosted }, present, absent, late] = await Promise.all([
    fetchServerYesterday(),
    evaluateNumberCard(ATTENDANCE_CARDS.present),
    evaluateNumberCard(ATTENDANCE_CARDS.absent),
    evaluateNumberCard(ATTENDANCE_CARDS.late),
  ]);
  return { date, present, absent, late, recordsPosted };
}

/**
 * Check-ins today and the permanent / daily-wage headcounts, straight from
 * the same workspace's Number Cards. Required for the same reason as
 * `fetchAttendanceDaySummary`: a fallback would be a made-up number.
 */
export async function fetchWorkspaceHeadlines(): Promise<WorkspaceHeadlines> {
  const [checkinsToday, permanentEmployees, dailyWageEmployees] = await Promise.all([
    evaluateNumberCard(WORKSPACE_CARDS.checkinsToday),
    evaluateNumberCard(WORKSPACE_CARDS.permanent),
    evaluateNumberCard(WORKSPACE_CARDS.dailyWages),
  ]);
  return { checkinsToday, permanentEmployees, dailyWageEmployees };
}
