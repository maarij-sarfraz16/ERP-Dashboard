interface KpiTileProps {
  label: string;
  value: string;
  footNote: string;
  delta?: { value: string; direction: "up" | "down" };
  variant?: "default" | "rust";
  animationClass?: string;
}

export function KpiTile({ label, value, footNote, delta, variant = "default", animationClass }: KpiTileProps) {
  return (
    <div className={`card bento-stat load-in ${animationClass ?? ""}`}>
      <div>
        <div className="card-label">{label}</div>
        <div className={`stat-value${variant === "rust" ? " rust" : ""}`}>{value}</div>
      </div>
      <div className="stat-foot">
        {delta && (
          <span className={`stat-delta ${delta.direction}`}>
            {delta.direction === "up" ? "▲" : "▼"} {delta.value}
          </span>
        )}
        <span>{footNote}</span>
      </div>
    </div>
  );
}
