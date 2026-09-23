import { useState } from "react";
import { useWorkforceData } from "../hooks/useWorkforceData";
import { PageHead } from "../components/common/PageHead";
import { SectionHeader } from "../components/common/SectionHeader";
import { AttendanceStackedChart } from "../components/charts/AttendanceStackedChart";
import { RangeToggle, type AttendanceRange } from "../components/attendance/RangeToggle";
import { CheckInTable } from "../components/attendance/CheckInTable";
import { toChartSeries } from "../api/attendanceCommon";

export function AttendancePage() {
  const { data, loading } = useWorkforceData();
  const [range, setRange] = useState<AttendanceRange>("daily");

  if (loading || !data) {
    return (
      <>
        <PageHead index="02 / 04" title="Attendance" subtitle="Shift-level presence tracking" />
        <p className="chart-sub">Loading attendance records…</p>
      </>
    );
  }

  const seriesByRange = {
    daily: toChartSeries(data.attendanceDaily),
    weekly: toChartSeries(data.attendanceWeekly),
    monthly: toChartSeries(data.attendanceMonthly),
  };

  const lateCount = data.recentCheckIns.filter((c) => c.status === "late").length;
  const absentCount = data.recentCheckIns.filter((c) => c.status === "absent").length;

  return (
    <>
      <PageHead index="02 / 04" title="Attendance" subtitle="Shift-level presence tracking — ATS Synthetic" />

      <SectionHeader index="01" title="Presence over time" />
      <div className="card chart-card load-in load-in-1" style={{ minHeight: 360 }}>
        <div className="chart-card-head">
          <div>
            <div className="chart-title">Attendance trend</div>
            <div className="chart-sub">
              {range === "daily" && "Last 30 days"}
              {range === "weekly" && "Last 12 weeks"}
              {range === "monthly" && "Last 12 months"}
            </div>
          </div>
          <RangeToggle value={range} onChange={setRange} />
        </div>
        <AttendanceStackedChart data={seriesByRange[range]} height={300} />
        <div className="legend-row" style={{ marginTop: 12 }}>
          <span className="legend-item">
            <span className="legend-swatch" style={{ background: "var(--data-green)" }} /> Present
          </span>
          <span className="legend-item">
            <span className="legend-swatch" style={{ background: "var(--data-amber)" }} /> Late
          </span>
          <span className="legend-item">
            <span className="legend-swatch" style={{ background: "var(--data-rust)" }} /> Absent
          </span>
        </div>
      </div>

      <SectionHeader index="02" title="Recent check-ins" />
      <div className="card load-in load-in-2">
        <div className="chart-card-head">
          <div>
            <div className="chart-title">Today's shift log</div>
            <div className="chart-sub">
              {lateCount} late arrival{lateCount === 1 ? "" : "s"} · {absentCount} absence
              {absentCount === 1 ? "" : "s"} flagged below
            </div>
          </div>
        </div>
        <CheckInTable rows={data.recentCheckIns} />
      </div>
    </>
  );
}
