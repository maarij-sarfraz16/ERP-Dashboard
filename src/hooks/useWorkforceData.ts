import { useEffect, useState } from "react";
import type { WorkforceApiResponse } from "../data/mockData";
import { fetchWorkforceData } from "../api/workforceApi";
import { tracked } from "../api/frappeClient";

interface WorkforceDataState {
  data: WorkforceApiResponse | null;
  loading: boolean;
  error: string | null;
}

export function useWorkforceData(): WorkforceDataState {
  const [data, setData] = useState<WorkforceApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // `tracked` mirrors success/failure into the shared connection store so the
    // app shell can render one clear "backend unreachable" screen.
    tracked(fetchWorkforceData())
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}
