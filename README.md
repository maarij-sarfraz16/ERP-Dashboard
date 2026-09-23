# ATS Synthetic — workforce dashboard

React + TypeScript + Vite front end for a Frappe / ERPNext (HRMS) backend.

## Connecting to Frappe

1. **Create API credentials.** In Frappe: *User list → (the dashboard's user) →
   Settings → API Access → Generate Keys*. The secret is displayed once.
   The user needs read permission on `Employee`, `Attendance`, `Salary Slip`
   and `Shift Type`.

2. **Fill in `.env`** (copy `.env.example` if it is missing):

   ```
   VITE_API_BASE_URL=http://10.1.1.98:8000
   VITE_FRAPPE_API_KEY=...
   VITE_FRAPPE_API_SECRET=...
   VITE_USE_DEV_PROXY=true
   ```

   Vite reads `.env` only at startup — restart `npm run dev` after editing it.

3. **CORS.** `http://10.1.1.98:8000` currently returns **no**
   `Access-Control-Allow-Origin` header, i.e. `allow_cors` is not configured.
   The browser blocks cross-origin requests before the API key is even checked,
   so direct calls would fail no matter how correct the credentials are.

   In development this is handled for you: requests go to Vite's `/frappe-api`
   proxy (`vite.config.ts`), which forwards them server-side, making everything
   same-origin. Nothing needs changing on the ERP server to develop.

   **A production build has no dev server and therefore no proxy.** Before
   deploying, add to `sites/common_site_config.json` on the Frappe host:

   ```json
   "allow_cors": ["http://localhost:5173", "http://10.1.1.98:5173"]
   ```

   One entry per exact origin (protocol + host + port) the dashboard is served
   from, then `bench restart`. Set `VITE_USE_DEV_PROXY=false` to test direct
   calls once that is in place.

4. **Verify.** Load the dashboard, open the browser console and run:

   ```js
   await testFrappeConnection()
   ```

   It checks reachability/CORS, then auth, then per-doctype read permission,
   and prints a table showing which step failed.

## Architecture

| Path | Role |
| --- | --- |
| `src/api/frappeClient.ts` | The only place that calls `fetch`. Applies base URL, `Authorization: token key:secret`, timeout and error normalisation. |
| `src/api/employeeApi.ts` | Frappe rows → `EmployeeApiResponse` |
| `src/api/workforceApi.ts` | Frappe rows → `WorkforceApiResponse` |
| `src/api/connectionStatus.ts` | Shared store driving the backend-unreachable screen |
| `src/api/testConnection.ts` | `window.testFrappeConnection()` |
| `src/hooks/use*Data.ts` | Unchanged `{ data, loading, error }` contract for components |
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
- **"Today" means the latest fully-posted day.** Attendance lands a day in
  arrears, and the most recent day is usually partial — presences are entered
  before absences are marked. The adapters walk back to the latest day whose
  row count covers ≥90% of the active roster, so presence and absence come from
  the same complete day.
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

Known rough edge: the growth headline on the payroll page compares the latest
month against the oldest in the window, and the current month is partial, so
it currently reads as a large decline.

## Scripts

```
npm run dev      # Vite dev server
npm run build    # tsc -b && vite build
npm run lint     # oxlint
```
