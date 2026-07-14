import { useState } from 'react';
import { formatDayMonth } from '@/lib/activityFormat';
import { smoothPath } from '@/lib/chartPath';
import { mean, sma3 } from './statsMath';
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

function volumeInsight(visible: WeekMetrics[]): string {
  const avg = mean(visible.map((w) => w.km));
  const last4 = visible.slice(-4);
  const prev4 = visible.slice(-8, -4);
  if (prev4.length === 0) return `Avg ${avg.toFixed(1)} km/week`;
  const a = mean(last4.map((w) => w.km));
  const p = mean(prev4.map((w) => w.km));
  const pct = p > 0 ? ((a - p) / p) * 100 : 0;
  return `Avg ${avg.toFixed(1)} km/week · ${pct >= 0 ? '+' : ''}${pct.toFixed(0)}% vs previous 4 weeks`;
}

export default function WeeklyVolumeChart({ weeks }: { weeks: WeekMetrics[] }) {
  const [period, setPeriod] = useState<AnalysisPeriod>('12');
  const [hover, setHover] = useState<number | null>(null);

  const visible = sliceByPeriod(weeks, period);
  const n = visible.length;
  const maxKm = Math.max(1, ...visible.map((w) => w.km));

  const x = (i: number) => ((i + 0.5) / n) * VB_W;
  const y = (v: number) => AXIS_Y - (v / maxKm) * PLOT_H;
  const barW = Math.min(46, (VB_W / Math.max(n, 1)) * 0.6);

  const trend = sma3(visible.map((w) => w.km));
  const trendPath =
    n >= 2 ? smoothPath(trend.map((v, i) => [x(i), y(v)])) : '';

  const hov = hover !== null && visible[hover] ? hover : null;
  const insight = volumeInsight(visible);
  const hoverReading = hov !== null
    ? `Week of ${formatDayMonth(visible[hov].start)} · ${visible[hov].km.toFixed(1)} km · ${visible[hov].count} run${visible[hov].count === 1 ? '' : 's'}`
    : null;

  return (
    <AnalysisCard
      title="Weekly volume"
      period={period}
      onPeriodChange={setPeriod}
      insight={insight}
      hoverReading={hoverReading}
    >
      <div className="relative mt-[10px]">
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="block w-full">
          <ChartGrid width={VB_W} top={TOP_Y} bottom={AXIS_Y} />
          {trendPath && (
            <path
              d={trendPath}
              fill="none"
              stroke="var(--neg)"
              strokeOpacity={0.45}
              strokeWidth={1.75}
              strokeDasharray="4 3"
              strokeLinecap="round"
            />
          )}
          {visible.map((w, i) => (
            <rect
              key={w.start.getTime()}
              x={x(i) - barW / 2}
              y={y(w.km)}
              width={barW}
              height={Math.max(0, AXIS_Y - y(w.km))}
              rx={2.5}
              fill="var(--acc)"
              opacity={hov === i ? 1 : 0.8}
            />
          ))}
          {n <= 13 &&
            visible.map(
              (w, i) =>
                w.km > 0 && (
                  <text
                    key={w.start.getTime()}
                    x={x(i)}
                    y={y(w.km) - 6}
                    fontSize="10"
                    textAnchor="middle"
                    fill="var(--muted-foreground)"
                  >
                    {w.km.toFixed(1)}
                  </text>
                ),
            )}
        </svg>
        <HoverStrip count={n} onEnter={setHover} onLeave={() => setHover(null)} />
      </div>
      <AxisLabels dates={visible.map((w) => w.start)} />
    </AnalysisCard>
  );
}
