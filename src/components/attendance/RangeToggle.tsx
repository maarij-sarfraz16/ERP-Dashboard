export type AttendanceRange = "daily" | "weekly" | "monthly";

const OPTIONS: { key: AttendanceRange; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
];

export function RangeToggle({
  value,
  onChange,
}: {
  value: AttendanceRange;
  onChange: (v: AttendanceRange) => void;
}) {
  return (
    <div className="range-toggle" role="group" aria-label="Attendance time range">
      {OPTIONS.map((opt) => (
        <button
          key={opt.key}
          type="button"
          className={opt.key === value ? "active" : ""}
          onClick={() => onChange(opt.key)}
          aria-pressed={opt.key === value}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
