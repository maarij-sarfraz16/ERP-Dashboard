import { useEffect, useState } from "react";
import { fetchHeadcountData, type HeadcountData } from "../api/headcountApi";
import { tracked } from "../api/frappeClient";

interface HeadcountState {
  data: HeadcountData | null;
  loading: boolean;
  error: string | null;
}

export function useHeadcountData(): HeadcountState {
  const [data, setData] = useState<HeadcountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    tracked(fetchHeadcountData())
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
