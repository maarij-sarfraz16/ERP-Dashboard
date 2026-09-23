import { useEffect, useState } from "react";
import type { EmployeeApiResponse } from "../data/employeeData";
import { fetchEmployeeData } from "../api/employeeApi";
import { tracked } from "../api/frappeClient";

interface EmployeeDataState {
  data: EmployeeApiResponse | null;
  loading: boolean;
  error: string | null;
}

export function useEmployeeData(): EmployeeDataState {
  const [data, setData] = useState<EmployeeApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // `tracked` mirrors success/failure into the shared connection store so the
    // app shell can render one clear "backend unreachable" screen.
    tracked(fetchEmployeeData())
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
