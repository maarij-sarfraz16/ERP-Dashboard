import { Link } from "react-router-dom";
import { useWorkforceData } from "../hooks/useWorkforceData";
import { useEmployeeData } from "../hooks/useEmployeeData";
import { PageHead } from "../components/common/PageHead";
import { SectionHeader } from "../components/common/SectionHeader";
import { KpiHero } from "../components/kpi/KpiHero";
import { KpiTile } from "../components/kpi/KpiTile";
import { AttendanceStackedChart } from "../components/charts/AttendanceStackedChart";
import { PayrollDeptChart } from "../components/charts/PayrollDeptChart";
import { HeadcountMiniChart } from "../components/charts/HeadcountMiniChart";
import { toChartSeries } from "../api/attendanceCommon";

export function OverviewPage() {
  const { data, loading } = useWorkforceData();
  const { data: employeeData, loading: employeeLoading } = useEmployeeData();

  if (loading || employeeLoading || !data || !employeeData) {
    return (
      <>
        <PageHead index="01 / 04" title="Overview" subtitle="Summary" />
        <p className="chart-sub">Loading floor data…</p>
      </>
    );
  }

  const { kpis, attendanceDaily, payrollByDepartment } = data;

  return (
    <>
      <PageHead index="01 / 04" title="Overview" subtitle="Summary — ATS Synthetic" />

      <SectionHeader index="01" title="Today at a glance" />
      <div className="bento">
        <KpiHero kpis={kpis} />
        <KpiTile
          label="TOTAL EMPLOYEES"
          value={kpis.totalEmployees.toLocaleString()}
          footNote="active"
          delta={{ value: `${kpis.employeesDelta7d}`, direction: "up" }}
          animationClass="load-in-2"
        />
        <KpiTile
          label="ABSENT TODAY"
          value={kpis.absentToday.toString()}
          footNote="across all shifts"
          variant="rust"
          animationClass="load-in-3"
        />
      </div>

      <SectionHeader index="02" title="One slice of everything" />
      <div className="chart-grid chart-grid-3">
        <div className="card chart-card load-in load-in-2" style={{ minHeight: 240 }}>
          <div className="chart-card-head">
            <div>
              <div className="chart-title">Attendance</div>
              <div className="chart-sub">Last 30 days</div>
            </div>
            <Link className="mini-chart-link" to="/attendance">
              View detail →
            </Link>
          </div>
          <AttendanceStackedChart data={toChartSeries(attendanceDaily)} height={180} />
        </div>

        <div className="card chart-card load-in load-in-3" style={{ minHeight: 240 }}>
          <div className="chart-card-head">
            <div>
              <div className="chart-title">Payroll</div>
              <div className="chart-sub">Cost by department, Rs lakh</div>
            </div>
            <Link className="mini-chart-link" to="/payroll">
              View detail →
            </Link>
          </div>
          <PayrollDeptChart data={payrollByDepartment} height={180} />
        </div>

        <div className="card chart-card load-in load-in-4" style={{ minHeight: 240 }}>
          <div className="chart-card-head">
            <div>
              <div className="chart-title">Employees</div>
              <div className="chart-sub">Top departments by headcount</div>
            </div>
            <Link className="mini-chart-link" to="/employees">
              View detail →
            </Link>
          </div>
          <HeadcountMiniChart data={employeeData.headcountByDepartment} height={180} />
        </div>
      </div>
    </>
  );
}
