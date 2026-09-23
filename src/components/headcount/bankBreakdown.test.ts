// Reconciliation: the "Salary Payment Mode · Bank" card vs. the LIVE Frappe
// site. Frappe's own grouping of Employee.bank_name (a GROUP BY on the
// server, under the database's collation) is the reference; the card must
// produce the same groups with the same counts, and its rows must add up to
// exactly the number of bank-paid employees.

import { describe, expect, it } from "vitest";
import { getList } from "../../api/frappeClient";
import { fetchEmployeeData } from "../../api/employeeApi";
import { bankBreakdown, NO_BANK_NAME } from "./hcShared";

describe("bank breakdown vs. the server's own GROUP BY bank_name", () => {
  it("has the same groups, counts and total as Frappe", async () => {
    const [serverRows, serverTotal, employees] = await Promise.all([
      getList<{ bank_name: string | null; count: number | string }>("Employee", {
        fields: ["bank_name", "count(name) as count"],
        filters: [["salary_mode", "=", "Bank"]],
        groupBy: "bank_name",
        limit: 0,
      }),
      getList<{ name: string }>("Employee", {
        fields: ["name"],
        filters: [["salary_mode", "=", "Bank"]],
        limit: 0,
      }),
      fetchEmployeeData(),
    ]);

    // Server groups, keyed the way the collation compares them. A blank and a
    // NULL bank name are both "no bank on file".
    const server = new Map<string, number>();
    for (const r of serverRows) {
      const key = (r.bank_name ?? "").trimEnd().toLowerCase();
      server.set(key, (server.get(key) ?? 0) + Number(r.count));
    }

    const app = bankBreakdown(employees.roster);
    const appMap = new Map(app.map((r) => [r.key, r.count]));

    console.log(
      `[reconcile] banks: server=${[...server.entries()].map(([k, n]) => `${k || "(blank)"}=${n}`).join(", ")} | ` +
        `app=${app.map((r) => `${r.label}=${r.count}`).join(", ")}`,
    );

    expect(appMap).toEqual(server);
    expect(app.reduce((n, r) => n + r.count, 0)).toBe(serverTotal.length);

    // Every label is a spelling that actually exists on an employee record.
    const spellings = new Set(employees.roster.map((e) => e.bankName));
    for (const r of app) {
      if (r.key) expect(spellings.has(r.label), `label "${r.label}" is not a stored value`).toBe(true);
      else expect(r.label).toBe(NO_BANK_NAME);
    }
    // "No bank name", if present, is the last row; the rest are ranked by count.
    const named = app.filter((r) => r.key);
    expect(app.slice(0, named.length)).toEqual(named);
    for (let i = 1; i < named.length; i++) expect(named[i - 1].count).toBeGreaterThanOrEqual(named[i].count);
  });
});
