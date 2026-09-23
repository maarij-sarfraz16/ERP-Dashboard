import { useEffect, useState } from "react";
import type { GratuityReport } from "../data/employeeData";
import { fetchGratuityReport } from "../api/gratuityApi";
import { tracked } from "../api/frappeClient";

interface GratuityReportState {
  report: GratuityReport | null;
  loading: boolean;
  error: string | null;
}

export function useGratuityReport(): GratuityReportState {
  const [report, setReport] = useState<GratuityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    tracked(fetchGratuityReport())
      .then((result) => {
        if (!cancelled) setReport(result);
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

  return { report, loading, error };
}
