interface TooltipRow {
  label: string;
  value: string;
  color: string;
}

export function ChartTooltip({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{title}</div>
      {rows.map((row) => (
        <div className="chart-tooltip-row" key={row.label}>
          <span style={{ color: row.color }}>{row.label}</span>
          <span>{row.value}</span>
        </div>
      ))}
    </div>
  );
}
