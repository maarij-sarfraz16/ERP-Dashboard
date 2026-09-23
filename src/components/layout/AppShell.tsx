import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

interface Props {
  children: ReactNode;
  user: string;
  onSignOut: () => void;
}

export function AppShell({ children, user, onSignOut }: Props) {
  return (
    <div className="app-shell">
      <Sidebar user={user} onSignOut={onSignOut} />
      <main className="main">{children}</main>
    </div>
  );
}
