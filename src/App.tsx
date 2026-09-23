import { useCallback } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
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
  const { user, signIn, signOut } = useAuth();
  const navigate = useNavigate();

  // Signing out from, say, /payroll leaves that path in the address bar, so the
  // next sign-in would land straight back there. Every session starts on the
  // overview instead.
  const handleSignIn = useCallback(
    async (username: string, password: string) => {
      const result = await signIn(username, password);
      if (result.ok) navigate("/overview", { replace: true });
      return result;
    },
    [signIn, navigate],
  );

  const handleSignOut = useCallback(() => {
    void signOut();
    navigate("/overview", { replace: true });
  }, [signOut, navigate]);

  // Pages render their own loading state; when a fetch fails against the
  // Frappe backend the shared connection store flips and the whole shell
  // swaps to one explanatory error screen instead of a stuck spinner.
  const { ok } = useConnectionState();

  if (!user) return <LoginPage onSignIn={handleSignIn} />;

  return (
    <AppShell user={user.fullName} onSignOut={handleSignOut}>
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
