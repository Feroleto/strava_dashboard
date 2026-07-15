import { useState } from 'react';
import { formatDayMonth } from '@/lib/activityFormat';
import { smoothPath } from '@/lib/chartPath';
import { mean, linreg } from './statsMath';
import { sliceByPeriod, type AnalysisPeriod } from './period';
import type { WeekMetrics } from './useTrainingMetrics';
import AnalysisCard from './AnalysisCard';
import ChartGrid from './ChartGrid';
import HoverStrip from './HoverStrip';
import AxisLabels from './AxisLabels';

const VB_W = 520;
const VB_H = 230;
const TOP_Y = 28;
const AXIS_Y = 200;
const PLOT_H = AXIS_Y - TOP_Y;

// consecutive non-null runs of ef; weeks with no Z2/HR data split the line
// into segments (same convention as AcwrChart)
function segments(values: (number | null)[]): number[][] {
  const segs: number[][] = [];
  let current: number[] = [];
  values.forEach((v, i) => {
    if (v === null) {
      if (current.length) segs.push(current);
      current = [];
    } else {
      current.push(i);
    }
  });
  if (current.length) segs.push(current);
  return segs;
}

export default function EfficiencyFactorChart({
  weeks,
  hasMaxHr = true,
}: {
  weeks: WeekMetrics[];
  /** false when the user hasn't configured a max HR yet — Z2 (and therefore
   * EF) is computed against the 150bpm placeholder in that case */
  hasMaxHr?: boolean;
}) {
  const [period, setPeriod] = useState<AnalysisPeriod>('12');
  const [hover, setHover] = useState<number | null>(null);

  const visible = sliceByPeriod(weeks, period);
  const n = visible.length;
  const values = visible.map((w) => w.ef);
  const finite = values.filter((v): v is number => v !== null);
  const yMax = Math.max(1e-9, ...finite) * 1.15;

  const x = (i: number) => ((i + 0.5) / n) * VB_W;
  const y = (v: number) => AXIS_Y - (v / yMax) * PLOT_H;

  const segs = segments(values);
  const paths = segs
    .filter((seg) => seg.length >= 2)
    .map((seg) => smoothPath(seg.map((i) => [x(i), y(values[i] as number)])));
  const lonePoints = segs.filter((seg) => seg.length === 1).map(([i]) => i);

  const avg = mean(finite);
  const trendPoints = values
    .map((v, i) => [i, v] as [number, number | null])
    .filter((p): p is [number, number] => p[1] !== null);
  let trendPct: number | null = null;
  if (trendPoints.length >= 2) {
    const xs = trendPoints.map((p) => p[0]);
    const ys = trendPoints.map((p) => p[1]);
    const { m, b } = linreg(xs, ys);
    const predFirst = m * xs[0] + b;
    const predLast = m * xs[xs.length - 1] + b;
    trendPct = predFirst > 0 ? ((predLast - predFirst) / predFirst) * 100 : 0;
  }

  const insight =
    finite.length === 0
      ? 'EF — not enough data'
      : `EF avg ${avg.toFixed(2)}` +
        (trendPct !== null
          ? ` · trend ${trendPct >= 0 ? '+' : ''}${trendPct.toFixed(0)}% over last ${trendPoints.length} weeks`
          : '') +
        (hasMaxHr ? '' : ' · Z2 threshold estimated (150bpm placeholder)');

  const hov = hover !== null && visible[hover] ? hover : null;
  const hoverReading =
    hov !== null
      ? `Week of ${formatDayMonth(visible[hov].start)} · EF ${values[hov] !== null ? (values[hov] as number).toFixed(2) : '—'}`
      : null;

  return (
    <AnalysisCard
      title="Efficiency Factor"
      period={period}
      onPeriodChange={setPeriod}
      insight={insight}
      hoverReading={hoverReading}
    >
      <div className="relative mt-[10px]">
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="block w-full">
          <ChartGrid width={VB_W} top={TOP_Y} bottom={AXIS_Y} />
          {paths.map((d, k) => (
            <path
              key={k}
              d={d}
              fill="none"
              stroke="var(--acc)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {visible.map(
            (w, i) =>
              values[i] !== null && (
                <circle
                  key={w.start.getTime()}
                  cx={x(i)}
                  cy={y(values[i] as number)}
                  r={hov === i ? 4 : lonePoints.includes(i) ? 3 : 2.5}
                  fill="var(--acc)"
                  stroke="var(--card)"
                  strokeWidth={1.5}
                />
              ),
          )}
        </svg>
        <HoverStrip count={n} onEnter={setHover} onLeave={() => setHover(null)} />
      </div>
      <AxisLabels dates={visible.map((w) => w.start)} />
    </AnalysisCard>
  );
}
