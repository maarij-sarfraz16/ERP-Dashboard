// Full-page error state shown by the app shell when the Frappe backend cannot
// be reached, so a failed fetch never leaves a page stuck on "Loading…" or
// crashes a chart on undefined data.

import { frappeBaseUrl } from "../../api/frappeClient";
import { useConnectionState } from "../../api/connectionStatus";
import { ThemeToggle } from "./ThemeToggle";

export function ConnectionError() {
  const { message, hint } = useConnectionState();

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Backend unreachable</h1>
          <p className="chart-sub">Connection</p>
        </div>
        <ThemeToggle />
      </div>

      <div
        className="card load-in"
        style={{
          marginTop: 20,
          padding: 24,
          borderLeft: "3px solid var(--status-absent)",
          maxWidth: 760,
        }}
      >
        <div className="chart-title" style={{ color: "var(--status-absent)" }}>
          {message || "The dashboard could not load data from Frappe."}
        </div>

        {hint ? (
          <p className="chart-sub" style={{ marginTop: 10, lineHeight: 1.6 }}>
            {hint}
          </p>
        ) : null}

        <p className="chart-sub" style={{ marginTop: 16, lineHeight: 1.6 }}>
          Endpoint: <code style={{ fontFamily: "var(--font-mono)" }}>{frappeBaseUrl}</code>
        </p>

        <ol
          className="chart-sub"
          style={{ marginTop: 16, paddingLeft: 20, lineHeight: 1.8 }}
        >
          <li>
            Open the browser console and run{" "}
            <code style={{ fontFamily: "var(--font-mono)" }}>await testFrappeConnection()</code>{" "}
            to see which step fails.
          </li>
          <li>
            If it reports <em>not authenticated</em>, the sign-in session has ended — reload the
            page and sign in again.
          </li>
          <li>
            Otherwise check{" "}
            <code style={{ fontFamily: "var(--font-mono)" }}>FRAPPE_API_BASE_URL</code>,{" "}
            <code style={{ fontFamily: "var(--font-mono)" }}>FRAPPE_API_KEY</code> and{" "}
            <code style={{ fontFamily: "var(--font-mono)" }}>FRAPPE_API_SECRET</code> in{" "}
            <code style={{ fontFamily: "var(--font-mono)" }}>.env</code> on the machine running
            the dashboard, then restart it — the server reads{" "}
            <code style={{ fontFamily: "var(--font-mono)" }}>.env</code> only at startup.
          </li>
        </ol>

        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            marginTop: 20,
            padding: "8px 18px",
            font: "500 13px/1 var(--font-body)",
            color: "var(--ink-on-accent)",
            background: "var(--ink)",
            border: "none",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      </div>
    </div>
  );
}
