import { useState } from "react";
import { PageLoader } from "../components/common/PageLoader";
import { useWorkforceData } from "../hooks/useWorkforceData";
import { useOvertimeReport } from "../hooks/useOvertimeReport";
import { PageHead } from "../components/common/PageHead";
import { SectionHeader } from "../components/common/SectionHeader";
import { ATTENDANCE_SERIES, LATE_SERIES, AttendanceStackedChart } from "../components/charts/AttendanceStackedChart";
import { RangeToggle, type AttendanceRange } from "../components/attendance/RangeToggle";
import { AttendanceLog } from "../components/attendance/AttendanceLog";
import { OvertimeSection } from "../components/attendance/OvertimeSection";

export function AttendancePage() {
  const { data, loading } = useWorkforceData();
  const [range, setRange] = useState<AttendanceRange>("daily");
  // `null` = the current month; the overtime section re-reads on change.
  const [overtimeMonth, setOvertimeMonth] = useState<string | null>(null);
  const overtime = useOvertimeReport(overtimeMonth);

  if (loading || !data) {
    return (
      <>
        <PageHead title="Attendance" subtitle="Shift-level presence tracking" />
        <PageLoader message="Loading attendance records…" />
      </>
    );
  }

  const seriesByRange = {
    daily: data.attendanceDaily,
    weekly: data.attendanceWeekly,
    monthly: data.attendanceMonthly,
  };

  return (
    <>
      <PageHead title="Attendance" subtitle="Shift-level presence tracking — ATS Synthetic" />

      <SectionHeader index="01" title="Presence over time" />
      <div className="card chart-card load-in load-in-1" style={{ minHeight: 360 }}>
        <div className="chart-card-head">
          <div>
            <div className="chart-title">Attendance trend</div>
            <div className="chart-sub">
              Attendance records by status ·{" "}
              {range === "daily" && "last 30 days"}
              {range === "weekly" && "last 12 weeks"}
              {range === "monthly" && "last 12 months"}
            </div>
          </div>
          <RangeToggle value={range} onChange={setRange} />
        </div>
        <AttendanceStackedChart data={seriesByRange[range]} height={300} />
        <div className="legend-row" style={{ marginTop: 12 }}>
          {ATTENDANCE_SERIES.map((s) => (
            <span className="legend-item" key={s.key}>
              <span className="legend-swatch" style={{ background: s.color }} /> {s.label}
            </span>
          ))}
          <span className="legend-item">
            <span
              className="legend-swatch"
              style={{ background: LATE_SERIES.color, height: 2, borderRadius: 1 }}
            />{" "}
            {LATE_SERIES.label}
          </span>
        </div>
      </div>

      <SectionHeader index="02" title="Overtime" />
      <OvertimeSection report={overtime.data} loading={overtime.loading} onMonthChange={setOvertimeMonth} />

      <SectionHeader index="03" title="Daily shift log" />
      <AttendanceLog initialDate={data.latestPostedDate} />
    </>
  );
}
