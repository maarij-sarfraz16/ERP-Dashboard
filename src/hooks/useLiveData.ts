import { useEffect, useState } from "react";
import { tracked } from "../api/frappeClient";

export interface LiveDataState<T> {
  data: T | null;
  /** True until the first load settles; background refreshes never set it. */
  loading: boolean;
  error: string | null;
}

/** How often an open page re-reads Frappe. */
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

/**
 * `{ data, loading, error }` for a Frappe read, kept current while the page
 * is open.
 *
 * Attendance is posted in batches through the morning and "yesterday" rolls
 * over at midnight, so a page fetched once and left open drifts away from
 * the ATS main dashboard within hours. This re-runs `fetcher` on an interval
 * and whenever the tab becomes visible again, replacing `data` in place —
 * the previous figures stay on screen until the new ones arrive, and a
 * failed refresh keeps the last good data rather than blanking the page.
 *
 * `fetcher` must be referentially stable (a module-level function).
 */
export function useLiveData<T>(fetcher: () => Promise<T>): LiveDataState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    const load = () => {
      if (inFlight || document.hidden) return;
      inFlight = true;
      // `tracked` mirrors success/failure into the shared connection store so
      // the app shell can render one clear "backend unreachable" screen.
      tracked(fetcher())
        .then((result) => {
          if (cancelled) return;
          setData(result);
          setError(null);
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
        })
        .finally(() => {
          inFlight = false;
          if (!cancelled) setLoading(false);
        });
    };

    load();
    const timer = window.setInterval(load, REFRESH_INTERVAL_MS);
    const onVisible = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetcher]);

  return { data, loading, error };
}
