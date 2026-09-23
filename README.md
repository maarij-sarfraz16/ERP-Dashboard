# ATS Synthetic — workforce dashboard

React + TypeScript + Vite front end for a Frappe / HR (HRMS) backend.

## Connecting to Frappe

1. **Create API credentials.** In Frappe: *User list → (the dashboard's user) →
   Settings → API Access → Generate Keys*. The secret is displayed once.
   The user needs read permission on `Employee`, `Attendance`, `Salary Slip`
   and `Shift Type`.

2. **Fill in `.env`** (copy `.env.example` if it is missing):

   ```
   FRAPPE_API_BASE_URL=http://10.1.1.98:8000
   FRAPPE_API_KEY=...
   FRAPPE_API_SECRET=...
   ```

   These names have **no `VITE_` prefix on purpose**: Vite only exposes
   `VITE_*` to client code, so the token stays server-side. Do not rename them.
   The app reads `.env` only at startup — restart it after editing.

3. **CORS — no longer applicable.** The browser never calls Frappe. It calls
   `/frappe-api/...` on the dashboard's own origin, where the server checks the
   session cookie and then relays the request with the API token attached
   (`server/api.mjs`). Every request is same-origin, in development and in
   production alike, so `allow_cors` on the Frappe host is not needed and
   nothing has to change on the ERP server.

   The relay forwards `GET`/`HEAD` only — the dashboard is read-only, and so is
   the relay. Requests without a valid session are rejected with 401 and never
   reach Frappe.

4. **Verify.** Sign in, open the browser console and run:

   ```js
   await testFrappeConnection()
   ```

   It checks that the relay is reachable, then auth, then per-doctype read
   permission, and prints a table showing which step failed.

## Signing in

Two fixed accounts, configured server-side. There is no user table, no
registration and no self-service password reset.

1. Generate a bcrypt hash for each account, on the machine that runs the app:

   ```
   npm run hash-password
   ```

   It prompts with the echo turned off and prints only the hash. The password
   itself is never stored, logged, or passed as an argument.

2. Put the results in `.env`:

   ```
   AUTH_USER_1=<first username>
   AUTH_PASSWORD_HASH_1=<hash from the first run>
   AUTH_USER_2=<second username>
   AUTH_PASSWORD_HASH_2=<hash from the second run>
   AUTH_COOKIE_SECURE=false   # true only when served over HTTPS
   ```

3. Restart the app. Usernames are matched case-insensitively; passwords are not.

Sessions live in the server's memory and are held by an `HttpOnly` cookie, so
they survive a page refresh, end when the browser closes, and are dropped when
the server restarts. Signing out destroys the session server-side immediately.
Ten failed attempts from one address pauses sign-in from it for 15 minutes.

## Architecture

| Path | Role |
| --- | --- |
| `src/api/frappeClient.ts` | The only place that calls `fetch`. Applies base URL, `Authorization: token key:secret`, timeout and error normalisation. |
| `src/api/attendanceDay.ts` | The one definition of "yesterday" and its present/absent/late figures — read from the ATS Number Cards, never computed here. |
| `src/api/attendanceReconciliation.test.ts` | `npm test`: fails if any page disagrees with the ATS Overview workspace (totals *and* employee-id sets). |
| `src/api/loanApi.ts` | Runs the ATS script report "HR Loan Summary" (`loan_management` app, doctype `HR Loan`) and reads one `HR Loan` document for the detail drawer. |
| `src/api/loanReconciliation.test.ts` | `npm test`: fails if the Loans page disagrees with that report — loan-id set, every field of every row, the five summary cards, the chart — or with the raw `HR Loan` table. |
| `src/api/employeeApi.ts` | Frappe rows → `EmployeeApiResponse` |
| `src/api/workforceApi.ts` | Frappe rows → `WorkforceApiResponse` |
| `src/api/connectionStatus.ts` | Shared store driving the backend-unreachable screen |
| `src/api/testConnection.ts` | `window.testFrappeConnection()` |
| `src/hooks/use*Data.ts` | Unchanged `{ data, loading, error }` contract for components; all built on `useLiveData`, which re-reads Frappe every 5 minutes and when the tab regains focus |
| `src/data/*.ts` | Response type definitions (+ the original mock payloads, now unused) |

Components are unaware of Frappe: the hooks return the same shapes the mock
data did, so the adapters in `src/api/` are the only thing to change if the
backend's doctypes or field names differ.

## Data semantics on this site

Decisions the adapters make that are not obvious from the doctype names. All
were driven by what the live site actually contains.

- **`Holiday` attendance is excluded from the charts.** HRMS writes an
  Attendance row for every employee on a plant holiday (~58k of 570k rows
  here). Counting those as absences would swamp the real absence signal. The
  per-employee sparkline treats them as present instead, since a fixed 14-cell
  strip has nowhere to show "not a working day".
- **Lateness comes from the `late_entry` flag, not `status`.** HRMS has no
  "Late" status; ~11% of `Present` rows carry `late_entry = 1`.
- **The headline attendance figures ARE the ATS main dashboard's.** The
  Overview tiles, the Employees page presence % and the Head Count attendance
  summary all describe *yesterday* — the calendar day before today in the
  Frappe site's time zone (Asia/Karachi), which is what the "Absent Yesterday",
  "Total Present (Yesterday)" and "Late Entry (Yesterday)" Number Cards on the
  ATS *Overview* workspace count. `src/api/attendanceDay.ts` fetches those
  Number Card documents and has Frappe evaluate them (the same
  `number_card.get_result` call the desk widget makes), and reads the date back
  from the server's own `Timespan: yesterday` filter. Nothing about the day or
  the counts is decided in the browser, so the two dashboards cannot drift:
  edit a card in Frappe and both change together. `npm test` proves it against
  the live site.

  The price is that early in the morning the figures are partial — attendance
  is posted in batches until ~10:30 the following day, presences before
  absences — exactly as they are on the ATS dashboard. The tile says how many
  records have been posted so far rather than silently showing an older day.
  (An earlier version of this app did the latter, picking the latest day with
  ≥90% of the roster posted; that is why it could show a different day, and a
  different absent count, from the main dashboard.)
- **Payroll figures use the last complete month, not the current one.** The
  site runs two overlapping cycles: semi-monthly (1–15, 16–31) for ~320
  daily-wage staff and monthly for ~1,850 permanent staff. The monthly run is
  only created at month end, so mid-month the only slips that exist are
  daily-wage ones — reporting on the current month would show a fraction of the
  real cost and zero permanent employees. Cost figures therefore trail by up to
  a month.
- **Headcounts count distinct employees.** Daily-wage staff hold two slips per
  month, so slip counts are not headcounts.
- **The payroll trend is trimmed to months that have data.** Payroll went live
  around April 2026; the leading empty months are dropped because
  `PayrollPage` derives its growth headline from the first point and a zero
  there produces "Infinity%".
- **Composition charts are plant-wide.** Department and employment-type splits
  come from grouped `count()` queries over the whole active roster, not from
  the 500 rows in the directory table.

- **Loans are the "HR Loan Summary" report, unfiltered.** The site's
  `loan_management` app keeps loans in `HR Loan` (+ child `HR Loan Repayment
  Schedule`); the standard Lending app is not installed, so the desk's "Loan
  Origination" workspace chart (`Loan Application` doctype) errors and has
  nothing to mirror. The Loans page runs the report through
  `frappe.desk.query_report.run` with no filters and shows its rows, its
  `report_summary` cards and its chart as sent. The report is not paginated
  and takes ~10 s on this site (it queries the schedule per loan), so it is
  run once and searched/filtered/sorted/paged in the browser; the
  reconciliation test proves the server's cards are plain sums/counts of its
  rows, so filtered footers are the same arithmetic. Loans held by Inactive
  or Left employees are included, as the report includes them (they are real
  receivables); an Employee-status filter can hide them. Each row is also
  cross-checked against its own schedule (row count vs. `repayment_periods`,
  scheduled total vs. `loan_amount`, paid rows vs. `total_amount_paid`) and
  flagged when they disagree — the report's figures are still what is shown.

- **Expense claims are the `Expense Claim` list, unfiltered.** There is no
  desk report for them, so the Expense Claims page reads every header (all
  docstatuses, in one list call) plus a grouped read of `Expense Claim
  Detail` for the Self/Wife/Son/Daughter split, and the claimant's
  `Employee.status`. This site uses the doctype for medical reimbursement:
  `custom_expense_type`, `custom_bill_of_month`, `custom_medical_amount`
  (entitlement) and `custom_remaining_balance_` are shown as stored. The
  summary tiles are plain sums over every claim; the charts and table follow
  the filters. "Awaiting approval" is any claim whose workflow state is not
  Approved/Rejected; "Approved, unpaid" is submitted claims with
  `status = Unpaid` (sanctioned minus reimbursed). Claims by Inactive or Left
  employees are included — an approved claim is payable regardless — and the
  Employee-status filter can hide them.

Known rough edge: the growth headline on the payroll page compares the latest
month against the oldest in the window, and the current month is partial, so
it currently reads as a large decline.

## Scripts

```
npm run dev            # dev server on :5173 — app, sign-in and relay, one port
npm run build          # tsc -b && vite build
npm start              # serve the built dist/ with sign-in and relay (PORT, default 5173)
npm run hash-password  # generate one account's bcrypt hash, interactively
npm run lint           # oxlint
npm test               # reconciliation against the live Frappe site in .env
```

`npm run dev` and `npm start` both serve the whole app on a single origin —
there is no separate API process to start.
