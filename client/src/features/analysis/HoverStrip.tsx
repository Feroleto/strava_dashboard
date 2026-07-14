interface HoverStripProps {
  count: number;
  onEnter: (i: number) => void;
  onLeave: () => void;
  onClick?: (i: number) => void;
}

// invisible overlay of `count` equal columns, one per week/bin/point, used by
// every Analysis chart to drive hover state (same technique as MetricChart
// and WeeklyChart's hover overlay)
export default function HoverStrip({
  count,
  onEnter,
  onLeave,
  onClick,
}: HoverStripProps) {
  return (
    <div className="absolute inset-0 flex">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={`flex-1${onClick ? ' cursor-pointer' : ''}`}
          onMouseEnter={() => onEnter(i)}
          onMouseLeave={onLeave}
          onClick={onClick ? () => onClick(i) : undefined}
        />
      ))}
    </div>
  );
}
