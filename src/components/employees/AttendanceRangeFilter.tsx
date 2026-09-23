import {
  WINDOW_PRESETS,
  type AttendanceWindow,
  type ResolvedRange,
} from "../../data/attendanceRange";

export function AttendanceRangeFilter({
  windowDays,
  resolved,
  loading,
  onChange,
}: {
  windowDays: AttendanceWindow;
  resolved: ResolvedRange;
  loading: boolean;
  onChange: (windowDays: AttendanceWindow) => void;
}) {
  return (
    <div className="emp-range">
      <div className="emp-range-controls">
        <div className="emp-chips" role="group" aria-label="Attendance window">
          {WINDOW_PRESETS.map((days) => {
            const active = windowDays === days;
            return (
              <button
                key={days}
                type="button"
                className={`emp-chip${active ? " active" : ""}`}
                onClick={() => onChange(days)}
                aria-pressed={active}
              >
                Last {days} days
              </button>
            );
          })}
        </div>
      </div>

      <div className="emp-range-label" aria-live="polite">
        {loading ? "Loading attendance…" : `Dots show ${resolved.label}`}
      </div>
    </div>
  );
}
