import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { ConnectionError } from "./components/common/ConnectionError";
import { useConnectionState } from "./api/connectionStatus";
import { OverviewPage } from "./pages/OverviewPage";
import { AttendancePage } from "./pages/AttendancePage";
import { PayrollPage } from "./pages/PayrollPage";
import { EmployeesPage } from "./pages/EmployeesPage";
import { GratuityReportPage } from "./pages/GratuityReportPage";
import { HeadcountPage } from "./pages/HeadcountPage";

export default function App() {
  // Pages render their own loading state; when a fetch fails against the
  // Frappe backend the shared connection store flips and the whole shell
  // swaps to one explanatory error screen instead of a stuck spinner.
  const { ok } = useConnectionState();

  return (
    <AppShell>
      {ok ? (
        <Routes>
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<OverviewPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/payroll" element={<PayrollPage />} />
          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="/gratuity-report" element={<GratuityReportPage />} />
          <Route path="/workforce" element={<HeadcountPage />} />
          <Route path="/headcount" element={<Navigate to="/workforce" replace />} />
        </Routes>
      ) : (
        <ConnectionError />
      )}
    </AppShell>
  );
}
