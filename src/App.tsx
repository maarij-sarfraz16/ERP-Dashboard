import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { ConnectionError } from "./components/common/ConnectionError";
import { useConnectionState } from "./api/connectionStatus";
import { OverviewPage } from "./pages/OverviewPage";
import { AttendancePage } from "./pages/AttendancePage";
import { PayrollPage } from "./pages/PayrollPage";
import { EmployeesPage } from "./pages/EmployeesPage";
import { GratuityReportPage } from "./pages/GratuityReportPage";
import { LoansPage } from "./pages/LoansPage";
import { ExpenseClaimsPage } from "./pages/ExpenseClaimsPage";
import { LoginPage } from "./pages/LoginPage";
import { useAuth } from "./hooks/useAuth";

export default function App() {
  const { state, signIn, signOut } = useAuth();

  // Pages render their own loading state; when a fetch fails against the
  // Frappe backend the shared connection store flips and the whole shell
  // swaps to one explanatory error screen instead of a stuck spinner.
  const { ok } = useConnectionState();

  // The session lives in an HttpOnly cookie, so on a refresh only the server
  // can say whether we are signed in. Render nothing for that one round trip
  // rather than flashing the login screen at a signed-in user.
  if (state.status === "checking") return null;
  if (state.status === "out") return <LoginPage onSignIn={signIn} />;

  return (
    <AppShell user={state.user} onSignOut={signOut}>
      {ok ? (
        <Routes>
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<OverviewPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/payroll" element={<PayrollPage />} />
          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="/gratuity-report" element={<GratuityReportPage />} />
          <Route path="/loans" element={<LoansPage />} />
          <Route path="/expense-claims" element={<ExpenseClaimsPage />} />
          {/* The Workforce page was folded into Employees; keep old links working. */}
          <Route path="/workforce" element={<Navigate to="/employees" replace />} />
          <Route path="/headcount" element={<Navigate to="/employees" replace />} />
        </Routes>
      ) : (
        <ConnectionError />
      )}
    </AppShell>
  );
}
