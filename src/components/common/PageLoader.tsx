/**
 * Shared loading state for a page body. Every page sits behind at least one
 * Frappe read, so the gap between clicking a nav link and seeing data can
 * run several seconds; a moving spinner makes that read as "working" instead
 * of a frozen page.
 */
export function PageLoader({ message = "Loading…" }: { message?: string }) {
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <span className="page-loader-spinner" aria-hidden="true" />
      <p className="chart-sub">{message}</p>
    </div>
  );
}
