export function SectionHeader({ index, title }: { index: string; title: string }) {
  return (
    <div className="section-header">
      <span className="section-index mono">{index}</span>
      <span className="section-title">{title}</span>
      <span className="section-rule" aria-hidden="true" />
    </div>
  );
}
