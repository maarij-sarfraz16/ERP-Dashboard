interface Props {
  /** Rendered height in px; the mark keeps its 48:46 aspect ratio. */
  size?: number;
  className?: string;
}

/** The ATS bolt mark, same artwork as the browser favicon. */
export function AtsLogo({ size = 28, className }: Props) {
  return (
    <img
      src="/favicon.svg"
      alt=""
      aria-hidden="true"
      width={Math.round((size * 48) / 46)}
      height={size}
      className={className}
      draggable={false}
    />
  );
}
