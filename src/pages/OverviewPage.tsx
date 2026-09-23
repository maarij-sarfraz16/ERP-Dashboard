import { useMemo, useState } from "react";
import { PageLoader } from "../components/common/PageLoader";
import { Link } from "react-router-dom";
import { payrollByDepartment } from "../api/workforceApi";
import { useWorkforceData } from "../hooks/useWorkforceData";
import { useEmployeeData } from "../hooks/useEmployeeData";
import { PageHead } from "../components/common/PageHead";
import { SectionHeader } from "../components/common/SectionHeader";
import { KpiHero } from "../components/kpi/KpiHero";
import { KpiTile } from "../components/kpi/KpiTile";
import { AttendanceStackedChart } from "../components/charts/AttendanceStackedChart";
import { PayrollDeptChart } from "../components/charts/PayrollDeptChart";
import { HeadcountMiniChart } from "../components/charts/HeadcountMiniChart";
import { MonthSelect } from "../components/common/MonthSelect";

export function OverviewPage() {
  const { data, loading } = useWorkforceData();
  const { data: employeeData, loading: employeeLoading } = useEmployeeData();
  // `null` until the reader picks one: the card opens on the current month.
  const [pickedMonth, setPickedMonth] = useState<string | null>(null);

  const months = useMemo(
    () =>
      (data?.payrollMonthly ?? [])
        .filter((m) => m.paid > 0 || !m.complete)
        .map((m) => m.key)
        .reverse(),
    [data],
  );
  const payrollMonth = pickedMonth ?? data?.defaultPayrollMonth ?? months[0] ?? "";
  const deptCosts = useMemo(
    () => payrollByDepartment(data?.payrollDeptMonthly ?? [], payrollMonth),
    [data, payrollMonth],
  );

  if (loading || employeeLoading || !data || !employeeData) {
    return (
      <>
        <PageHead index="01 / 04" title="Overview" subtitle="Summary" />
        <PageLoader message="Loading floor data…" />
      </>
    );
  }

  const { kpis, attendanceDaily, payrollMonthly } = data;
  const inProgress = payrollMonthly.find((m) => !m.complete)?.key;

  return (
    <>
      <PageHead index="01 / 04" title="Overview" subtitle="Summary — ATS Synthetic" />

      <SectionHeader index="01" title="Today at a glance" />
      <div className="bento">
        <KpiHero kpis={kpis} />
        <KpiTile
          label="TOTAL EMPLOYEES"
          value={kpis.totalEmployees.toLocaleString()}
          footNote="active · joined in last 7 days"
          delta={{ value: `${kpis.employeesDelta7d}`, direction: "up" }}
          animationClass="load-in-2"
        />
        <KpiTile
          label="TOTAL CHECK-INS TODAY"
          value={kpis.checkinsToday.toLocaleString()}
          footNote="employee check-ins logged today, all shifts"
          animationClass="load-in-3"
        />
        <KpiTile
          label="PERMANENT EMPLOYEES"
          value={kpis.permanentEmployees.toLocaleString()}
          footNote="employment type Permanent, all statuses"
          animationClass="load-in-4"
        />
        <KpiTile
          label="DAILY WAGES EMPLOYEES"
          value={kpis.dailyWageEmployees.toLocaleString()}
          footNote="employment type Daily Wages, all statuses"
          animationClass="load-in-5"
        />
      </div>

      <SectionHeader index="02" title="One slice of everything" />
      <div className="chart-grid chart-grid-3">
        <div className="card chart-card load-in load-in-2" style={{ minHeight: 240 }}>
          <div className="chart-card-head">
            <div>
              <div className="chart-title">Attendance</div>
              <div className="chart-sub">Records by status, last 30 days</div>
            </div>
            <Link className="mini-chart-link" to="/attendance">
              View detail →
            </Link>
          </div>
          <AttendanceStackedChart data={attendanceDaily} height={180} />
        </div>

        <div className="card chart-card load-in load-in-3" style={{ minHeight: 240 }}>
          <div className="chart-card-head">
            <div>
              <div className="chart-title">Payroll</div>
              <div className="chart-sub">
                Paid salary by department, Rs million
                {payrollMonth === inProgress ? " · in progress" : ""}
              </div>
            </div>
            <div className="mini-chart-actions">
              <MonthSelect value={payrollMonth} months={months} inProgress={inProgress} onChange={setPickedMonth} />
              <Link className="mini-chart-link" to="/payroll">
                View detail →
              </Link>
            </div>
          </div>
          <PayrollDeptChart data={deptCosts} height={180} />
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
