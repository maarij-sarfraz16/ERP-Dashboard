import { NavLink } from "react-router-dom";
import { useTheme } from "../../hooks/useTheme";

const NAV_ITEMS = [
  { to: "/overview", index: "01", label: "Overview" },
  { to: "/attendance", index: "02", label: "Attendance" },
  { to: "/payroll", index: "03", label: "Payroll" },
  { to: "/employees", index: "04", label: "Employees" },
  { to: "/workforce", index: "05", label: "Workforce" },
];

export function Sidebar() {
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">ATS Synthetic</span>
        <span className="brand-sub">HRMS DASHBOARD</span>
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
            <span className="nav-index">{item.index}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <span className="brand-sub">
          {theme === "dark" ? "Dark Mode" : "Light Mode"}
        </span>
        <button
          type="button"
          className="theme-toggle"
          data-active={theme}
          onClick={toggleTheme}
          aria-label="Toggle dark mode"
        >
          <span className="theme-toggle-dot" />
        </button>
      </div>
    </aside>
  );
}
