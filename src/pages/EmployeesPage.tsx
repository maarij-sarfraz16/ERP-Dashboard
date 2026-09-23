import "../styles/employees.css";
import { useEmployeeData } from "../hooks/useEmployeeData";
import { PageHead } from "../components/common/PageHead";
import { SectionHeader } from "../components/common/SectionHeader";
import { EmployeeHero } from "../components/employees/EmployeeHero";
import { DepartmentCompositionBar } from "../components/employees/DepartmentCompositionBar";
import { EmployeeDirectory } from "../components/employees/EmployeeDirectory";
import { EmploymentSplitBars } from "../components/employees/EmploymentSplitBars";
import { NewHiresStrip } from "../components/employees/NewHiresStrip";
import { PresenceArc } from "../components/employees/PresenceArc";

export function EmployeesPage() {
  const { data, loading } = useEmployeeData();

  if (loading || !data) {
    return (
      <div className="employees-page">
        <PageHead index="04 / 04" title="Employees" subtitle="Workforce roster" />
        <p className="chart-sub">Loading roster…</p>
      </div>
    );
  }

  const departments = data.headcountByDepartment.map((d) => d.department);

  return (
    <div className="employees-page">
      <PageHead index="04 / 04" title="Employees" subtitle="Workforce roster — ATS Synthetic" />

      <EmployeeHero
        totalActive={data.totalActive}
        activeDelta7d={data.activeDelta7d}
        dailyWageCount={data.dailyWageCount}
        newHiresThisQuarter={data.newHiresThisQuarter}
        presentTodayPct={data.presentTodayPct}
      />

      <SectionHeader index="01" title="Composition by department" />
      <DepartmentCompositionBar data={data.headcountByDepartment} />

      <SectionHeader index="02" title="People & patterns" />
      <div className="emp-layout">
        <EmployeeDirectory employees={data.employees} departments={departments} />

        <div className="emp-side-stack">
          <div className="emp-panel load-in">
            <div className="emp-panel-title">Employment type</div>
            <div className="emp-panel-sub">Headcount split</div>
            <EmploymentSplitBars data={data.employmentTypeSplit} />
          </div>

          <div className="emp-panel load-in">
            <div className="emp-panel-title">New hires</div>
            <div className="emp-panel-sub">By month, last 12 months</div>
            <NewHiresStrip data={data.newHiresByMonth} />
          </div>

          <div className="emp-panel load-in">
            <div className="emp-panel-title">Presence</div>
            <div className="emp-panel-sub">Plant-wide today</div>
            <PresenceArc pct={data.presentTodayPct} />
          </div>
        </div>
      </div>
    </div>
  );
}
