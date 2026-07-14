import { useState } from 'react';
import { formatDayMonth } from '@/lib/activityFormat';
import { smoothPath } from '@/lib/chartPath';
import { sliceByPeriod, type AnalysisPeriod } from './period';
import type { WeekMetrics } from './useTrainingMetrics';
import AnalysisCard from './AnalysisCard';
import ChartGrid from './ChartGrid';
import HoverStrip from './HoverStrip';
import AxisLabels from './AxisLabels';

const VB_W = 900;
const VB_H = 170;
const TOP_Y = 20;
const AXIS_Y = 146;
const PLOT_H = AXIS_Y - TOP_Y;
const MONOTONY_MAX = 2.3;

function monotonyStatus(m: number): string {
  if (m < 1.5) return 'varied training';
  if (m <= 2.0) return 'getting monotonous';
  return 'high risk';
}

export default function MonotonyStrainChart({ weeks }: { weeks: WeekMetrics[] }) {
  const [period, setPeriod] = useState<AnalysisPeriod>('12');
  const [hover, setHover] = useState<number | null>(null);

  const visible = sliceByPeriod(weeks, period);
  const n = visible.length;
  const maxStrain = Math.max(1e-9, ...visible.map((w) => w.strain));

  const x = (i: number) => ((i + 0.5) / n) * VB_W;
  const yBar = (v: number) => AXIS_Y - (v / maxStrain) * PLOT_H;
  const yLine = (v: number) => AXIS_Y - (v / MONOTONY_MAX) * PLOT_H;
  const barW = Math.min(40, (VB_W / Math.max(n, 1)) * 0.6);

  const linePath =
    n >= 2
      ? smoothPath(visible.map((w, i) => [x(i), yLine(w.monotony)]))
      : '';

  const last = visible.at(-1);
  const insight = last
    ? `Monotony ${last.monotony.toFixed(2)} — ${monotonyStatus(last.monotony)} · strain ${Math.round(last.strain)} a.u.`
    : 'no data';

  const hov = hover !== null && visible[hover] ? hover : null;
  const hoverReading =
    hov !== null
      ? `Week of ${formatDayMonth(visible[hov].start)} · monotony ${visible[hov].monotony.toFixed(2)} · strain ${Math.round(visible[hov].strain)} a.u.`
      : null;

  return (
    <AnalysisCard
      title="Monotony & strain"
      period={period}
      onPeriodChange={setPeriod}
      insight={insight}
      hoverReading={hoverReading}
      fullWidth
    >
      <div className="relative mt-[10px]">
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="block w-full">
          <ChartGrid width={VB_W} top={TOP_Y} bottom={AXIS_Y} />
          <text x={6} y={16} fontSize="10" fill="var(--muted-foreground)">
            bars = strain
          </text>

          {visible.map((w, i) => (
            <rect
              key={w.start.getTime()}
              x={x(i) - barW / 2}
              y={yBar(w.strain)}
              width={barW}
              height={Math.max(0, AXIS_Y - yBar(w.strain))}
              fill="var(--acc)"
              opacity={hov === i ? 0.25 : 0.13}
            />
          ))}

          <line
            x1={0}
            y1={yLine(1.5)}
            x2={VB_W}
            y2={yLine(1.5)}
            stroke="var(--grid-ax)"
            strokeDasharray="2 3"
          />
          <text x={VB_W - 4} y={yLine(1.5) - 4} fontSize="10" textAnchor="end" fill="var(--muted-foreground)">
            warning 1.5
          </text>
          <line
            x1={0}
            y1={yLine(2.0)}
            x2={VB_W}
            y2={yLine(2.0)}
            stroke="var(--neg)"
            strokeOpacity={0.5}
            strokeDasharray="2 3"
          />
          <text x={VB_W - 4} y={yLine(2.0) - 4} fontSize="10" textAnchor="end" fill="var(--neg)">
            high risk 2.0
          </text>

          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="var(--acc)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {visible.map((w, i) => (
            <circle
              key={w.start.getTime()}
              cx={x(i)}
              cy={yLine(w.monotony)}
              r={hov === i ? 4 : 2.5}
              fill="var(--acc)"
              stroke="var(--card)"
              strokeWidth={1.5}
            />
          ))}
        </svg>
        <HoverStrip count={n} onEnter={setHover} onLeave={() => setHover(null)} />
      </div>
      <AxisLabels dates={visible.map((w) => w.start)} width={860} />
    </AnalysisCard>
  );
}
