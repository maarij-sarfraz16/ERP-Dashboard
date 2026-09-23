import { formatMonthKey } from "../payroll/payrollFormat";

/**
 * Pill-shaped month picker used wherever a figure describes one payroll
 * month. `months` are `"2026-09"` keys; the one still in progress is marked.
 */
export function MonthSelect({
  value,
  months,
  inProgress,
  onChange,
  label = "Month",
}: {
  value: string;
  /** Month keys to offer, in whatever order they should be listed. */
  months: string[];
  /** The month whose runs are not all posted yet, if it is in `months`. */
  inProgress?: string;
  onChange: (month: string) => void;
  label?: string;
}) {
  return (
    <label className="month-select">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {months.map((m) => (
          <option key={m} value={m}>
            {formatMonthKey(m)}
            {m === inProgress ? " (in progress)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
