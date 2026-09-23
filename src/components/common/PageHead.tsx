import { ThemeToggle } from "./ThemeToggle";

export function PageHead({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        <p className="chart-sub">{subtitle}</p>
      </div>
      <ThemeToggle />
    </div>
  );
}
