import { NavLink } from "react-router-dom";
import { AtsLogo } from "../common/AtsLogo";

const NAV_ITEMS = [
  { to: "/overview", label: "Overview" },
  { to: "/attendance", label: "Attendance" },
  { to: "/payroll", label: "Payroll" },
  { to: "/employees", label: "Employees" },
  { to: "/loans", label: "Loans" },
  { to: "/expense-claims", label: "Expense Claims" },
];

interface Props {
  user: string;
  onSignOut: () => void;
}

export function Sidebar({ user, onSignOut }: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <AtsLogo size={26} />
        <div className="brand">
          <span className="brand-mark">ATS Synthetic</span>
          <span className="brand-sub">HRMS DASHBOARD</span>
        </div>
      </div>

      <nav className="nav-group">
        <span className="nav-label">MENU</span>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer is pinned to the bottom and sized by the button, not the
          address: a long email wraps onto a second line above it rather than
          pushing Sign out sideways. */}
      <div className="sidebar-user">
        <span className="sidebar-email" title={user}>
          {user}
        </span>
        <button type="button" className="sign-out" onClick={onSignOut}>
          <svg
            className="sign-out-icon"
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  );
}
