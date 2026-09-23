import { useWorkforceData } from "../hooks/useWorkforceData";
import { PageHead } from "../components/common/PageHead";
import { SectionHeader } from "../components/common/SectionHeader";
import { PayrollTrendChart } from "../components/charts/PayrollTrendChart";
import { EmploymentTypeBar } from "../components/charts/EmploymentTypeBar";
import { PayrollRunsTable } from "../components/payroll/PayrollRunsTable";

function formatCurrency(v: number): string {
  return `Rs ${(v / 100000).toFixed(1)}L`;
}

export function PayrollPage() {
  const { data, loading } = useWorkforceData();

  if (loading || !data) {
    return (
      <>
        <PageHead index="03 / 04" title="Payroll" subtitle="Cost tracking and run history" />
        <p className="chart-sub">Loading payroll records…</p>
      </>
    );
  }

  const latestAmount = data.payrollTrend[data.payrollTrend.length - 1].amount;
  const firstAmount = data.payrollTrend[0].amount;
  const growthPct = (((latestAmount - firstAmount) / firstAmount) * 100).toFixed(1);

  return (
    <>
      <PageHead index="03 / 04" title="Payroll" subtitle="Cost tracking and run history — ATS Synthetic" />

      <SectionHeader index="01" title="Cost trend" />
      <div className="chart-grid">
        <div className="card chart-card load-in load-in-1">
          <div className="chart-card-head">
            <div>
              <div className="chart-title">Payroll cost, last 12 months</div>
              <div className="chart-sub">
                {formatCurrency(latestAmount)} this month · {growthPct}% vs 12 months ago
              </div>
            </div>
          </div>
          <PayrollTrendChart data={data.payrollTrend} />
        </div>

        <div className="card chart-card load-in load-in-2">
          <div className="chart-card-head">
            <div>
              <div className="chart-title">By employment type</div>
              <div className="chart-sub">Current cycle cost split</div>
            </div>
          </div>
          <EmploymentTypeBar data={data.employmentTypeBreakdown} />
        </div>
      </div>

      <SectionHeader index="02" title="Recent payroll runs" />
      <div className="card load-in load-in-3">
        <PayrollRunsTable rows={data.recentPayrollRuns} />
      </div>
    </>
  );
}
