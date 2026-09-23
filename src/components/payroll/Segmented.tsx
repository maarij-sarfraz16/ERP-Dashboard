export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; count?: number; color?: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="py-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={o.value === value ? "active" : undefined}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.color && <span className="py-seg-dot" style={{ background: o.color }} />}
          {o.label}
          {o.count !== undefined && <span className="py-seg-count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
