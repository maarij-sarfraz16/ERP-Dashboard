import { useEffect, useMemo, useState } from "react";
import { fetchAttendanceMarks, type AttendanceMarks } from "../api/attendanceMarks";
import { resolveRange, type AttendanceWindow, type ResolvedRange } from "../data/attendanceRange";

interface AttendanceMarksState {
  resolved: ResolvedRange;
  marks: AttendanceMarks;
  loading: boolean;
  error: string | null;
}

/**
 * Attendance marks for `ids` (the employees currently on screen) over the
 * last `windowDays`. Refetches when either changes; the previous marks stay
 * on screen while the new ones load so the list doesn't flash empty.
 */
export function useAttendanceMarks(ids: string[], windowDays: AttendanceWindow): AttendanceMarksState {
  const resolved = useMemo(() => resolveRange(windowDays), [windowDays]);
  const [marks, setMarks] = useState<AttendanceMarks>(() => new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Effect dependency on content, not array identity — `ids` is rebuilt
  // every render by the caller.
  const idsKey = ids.join("\n");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAttendanceMarks(idsKey ? idsKey.split("\n") : [], resolved.start, resolved.end)
      .then((result) => {
        if (!cancelled) setMarks(result);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load attendance");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [idsKey, resolved.start, resolved.end]);

  return { resolved, marks, loading, error };
}
