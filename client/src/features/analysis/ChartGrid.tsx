interface ChartGridProps {
  width: number;
  top: number;
  bottom: number;
}

// 4 evenly-spaced dashed background gridlines, no numeric labels — shared by
// every Analysis chart (this page deliberately omits a numeric Y axis)
export default function ChartGrid({ width, top, bottom }: ChartGridProps) {
  const lines = [0, 1, 2, 3].map((k) => top + (k * (bottom - top)) / 3);
  return (
    <>
      {lines.map((y) => (
        <line
          key={y}
          x1={0}
          y1={y}
          x2={width}
          y2={y}
          stroke="var(--border)"
          strokeDasharray="3 5"
        />
      ))}
    </>
  );
}
