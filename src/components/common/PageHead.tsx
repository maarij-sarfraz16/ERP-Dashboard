export function PageHead({ index, title, subtitle }: { index: string; title: string; subtitle: string }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        <p className="chart-sub">{subtitle}</p>
      </div>
      <span className="page-index">{index}</span>
    </div>
  );
}
