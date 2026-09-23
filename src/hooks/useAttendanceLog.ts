import { useEffect, useRef, useState } from "react";
import { fetchAttendanceLog, type AttendanceLog } from "../api/attendanceLogApi";
import { tracked } from "../api/frappeClient";

interface AttendanceLogState {
  log: AttendanceLog | null;
  loading: boolean;
  error: string | null;
}

/**
 * Loads the attendance log for one date. Days already fetched are kept in a
 * per-mount cache, so stepping back to a date you've seen doesn't hit Frappe
 * again.
 */
export function useAttendanceLog(date: string | null): AttendanceLogState {
  const cache = useRef(new Map<string, AttendanceLog>());
  const [log, setLog] = useState<AttendanceLog | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!date) return;
    const hit = cache.current.get(date);
    if (hit) {
      setLog(hit);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    tracked(fetchAttendanceLog(date))
      .then((result) => {
        cache.current.set(date, result);
        if (!cancelled) setLog(result);
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
  }, [date]);

  return { log, loading, error };
}
