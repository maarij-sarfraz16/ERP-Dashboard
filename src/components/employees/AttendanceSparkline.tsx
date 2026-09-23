import type { DayMark } from "../../data/employeeData";

const COLOR: Record<DayMark, string> = {
  present: "var(--emp-moss)",
  late: "var(--emp-gold)",
  absent: "var(--emp-coral)",
};

export function AttendanceSparkline({ marks }: { marks: DayMark[] }) {
  return (
    <div className="emp-spark" role="img" aria-label="Last 14 days attendance">
      {marks.map((mark, i) => (
        <span
          key={i}
          className="emp-spark-dot"
          style={{ background: COLOR[mark], opacity: mark === "present" ? 0.9 : 1 }}
        />
      ))}
    </div>
  );
}
