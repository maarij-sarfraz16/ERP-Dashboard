import type { DayMark } from "../../data/employeeData";

const COLOR: Record<DayMark, string> = {
  present: "var(--emp-moss)",
  late: "var(--emp-gold)",
  absent: "var(--emp-coral)",
};

const MARK_LABEL: Record<DayMark, string> = {
  present: "Present",
  late: "Late / half day",
  absent: "Absent / no record",
};

function dotTitle(day: string, mark: DayMark): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return `${date} — ${MARK_LABEL[mark]}`;
}

/** One dot per entry in `days`; `marks[i]` is the mark for `days[i]`. */
export function AttendanceSparkline({ marks, days, label }: { marks: DayMark[]; days: string[]; label: string }) {
  return (
    <div className="emp-spark" role="img" aria-label={`Attendance, ${label}`}>
      {marks.map((mark, i) => (
        <span
          key={days[i] ?? i}
          className="emp-spark-dot"
          title={days[i] ? dotTitle(days[i], mark) : undefined}
          style={{ background: COLOR[mark], opacity: mark === "present" ? 0.9 : 1 }}
        />
      ))}
    </div>
  );
}
