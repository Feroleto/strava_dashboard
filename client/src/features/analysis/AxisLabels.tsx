import { formatDayMonth } from '@/lib/activityFormat';

interface AxisLabelsProps {
  dates: Date[];
  /** approx rendered width in px, used to decide how many labels fit */
  width?: number;
}

// decimated dd/mm label row below a chart's plot area — shows ~1 label per
// 110px so labels never overlap, same rule used by MetricChart/WeeklyChart
export default function AxisLabels({ dates, width = 480 }: AxisLabelsProps) {
  const n = dates.length;
  const maxLabels = Math.max(1, Math.floor(width / 110));
  const labelEvery = Math.max(1, Math.ceil(n / maxLabels));
  return (
    <div className="mt-1 flex pb-1">
      {dates.map((d, i) => (
        <div
          key={d.getTime()}
          className="flex-1 text-center text-[11px] text-muted-foreground"
        >
          {i % labelEvery === 0 ? formatDayMonth(d) : ''}
        </div>
      ))}
    </div>
  );
}
