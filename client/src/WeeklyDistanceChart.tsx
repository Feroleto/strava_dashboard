import { useEffect, useMemo, useState } from 'react';
import type { DateRange } from './DateRangeFilter';

interface WeeklyDistancePoint {
  weekStart: string;
  totalKm: number;
  totalTimeSec: number;
}

interface WeeklyDistanceResponse {
  weeks: WeeklyDistancePoint[];
}

interface WeeklyDistanceChartProps {
  workoutType: string;
  dateRange: DateRange;
}

const CHART_W = 720;
const CHART_H = 200;
const PAD_LEFT = 40;
const PAD_RIGHT = 8;
const PAD_TOP = 10;
const PAD_BOTTOM = 22;

const BAR_COLOR = '#3987e5';
const BAR_HOVER_COLOR = '#6da7ec';
const GRID_COLOR = '#1e293b'; // slate-800
const AXIS_COLOR = '#334155'; // slate-700

function formatWeekLabel(weekStart: string): string {
  return `${weekStart.slice(8, 10)}/${weekStart.slice(5, 7)}`;
}

function formatWeekLabelFull(weekStart: string): string {
  return `${weekStart.slice(8, 10)}/${weekStart.slice(5, 7)}/${weekStart.slice(2, 4)}`;
}

function niceTicks(maxValue: number): number[] {
  if (maxValue <= 0) return [0];
  const steps = [1, 2, 5, 10, 20, 25, 50, 100];
  const step =
    steps.find((s) => Math.ceil(maxValue / s) <= 4) ??
    steps[steps.length - 1];
  const top = Math.ceil(maxValue / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  return ticks;
}

// Rounded corners only at the top; square at the baseline.
function barPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  return [
    `M ${x} ${y + h}`,
    `V ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    `H ${x + w - r}`,
    `Q ${x + w} ${y} ${x + w} ${y + r}`,
    `V ${y + h}`,
    'Z',
  ].join(' ');
}

export default function WeeklyDistanceChart({
  workoutType,
  dateRange,
}: WeeklyDistanceChartProps) {
  const [weeks, setWeeks] = useState<WeeklyDistancePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (workoutType) params.set('workoutType', workoutType);
    if (dateRange.from) params.set('dateFrom', dateRange.from);
    if (dateRange.to) params.set('dateTo', dateRange.to);

    fetch(`http://localhost:3000/activities/weekly-distance?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: WeeklyDistanceResponse) => {
        setWeeks(data.weeks);
        setError(null);
        setHovered(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [workoutType, dateRange]);

  const totalKm = useMemo(
    () => weeks.reduce((sum, w) => sum + w.totalKm, 0),
    [weeks],
  );

  const geometry = useMemo(() => {
    const innerW = CHART_W - PAD_LEFT - PAD_RIGHT;
    const innerH = CHART_H - PAD_TOP - PAD_BOTTOM;
    const n = weeks.length;
    const maxKm = Math.max(0, ...weeks.map((w) => w.totalKm));
    const ticks = niceTicks(maxKm);
    const yMax = ticks[ticks.length - 1] || 1;
    const band = n > 0 ? innerW / n : 0;
    const barW = Math.max(2, Math.min(24, band - 2));
    const labelEvery = n > 0 ? Math.ceil(n / 8) : 1;

    const bars = weeks.map((w, i) => {
      const h = (w.totalKm / yMax) * innerH;
      return {
        x: PAD_LEFT + i * band + (band - barW) / 2,
        y: PAD_TOP + innerH - h,
        w: barW,
        h,
        bandX: PAD_LEFT + i * band,
        centerX: PAD_LEFT + i * band + band / 2,
      };
    });

    return { innerH, ticks, yMax, band, labelEvery, bars };
  }, [weeks]);

  const hasData = weeks.length > 0 && geometry.ticks.length > 1;

  return (
    <div className="mb-4 rounded border border-slate-800 bg-slate-900/40 p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-slate-200">
          Weekly distance
        </h2>
        {hasData && (
          <span className="text-xs text-slate-400">
            {totalKm.toFixed(1)} km total · {weeks.length} weeks
          </span>
        )}
      </div>

      {error ? (
        <p className="py-10 text-center text-sm text-red-400">
          Error: {error}
        </p>
      ) : !hasData && !loading ? (
        <p className="py-10 text-center text-sm text-slate-500">
          No activities in this period
        </p>
      ) : (
        <div
          className={`relative transition-opacity ${loading ? 'opacity-50' : 'opacity-100'}`}
        >
          <svg
            viewBox={`0 0 ${CHART_W} ${CHART_H}`}
            className="block w-full"
            role="img"
            aria-label="Weekly running distance in kilometers"
          >
            {/* gridlines + y ticks */}
            {geometry.ticks.map((tick) => {
              const y =
                PAD_TOP + geometry.innerH - (tick / geometry.yMax) * geometry.innerH;
              return (
                <g key={tick}>
                  <line
                    x1={PAD_LEFT}
                    x2={CHART_W - PAD_RIGHT}
                    y1={y}
                    y2={y}
                    stroke={tick === 0 ? AXIS_COLOR : GRID_COLOR}
                    strokeWidth={1}
                  />
                  <text
                    x={PAD_LEFT - 6}
                    y={y + 3.5}
                    textAnchor="end"
                    fontSize={10}
                    fill="#64748b"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {tick}
                  </text>
                </g>
              );
            })}

            {/* bars */}
            {geometry.bars.map((bar, i) =>
              bar.h > 0 ? (
                <path
                  key={weeks[i].weekStart}
                  d={barPath(bar.x, bar.y, bar.w, bar.h)}
                  fill={hovered === i ? BAR_HOVER_COLOR : BAR_COLOR}
                />
              ) : null,
            )}

            {/* x labels */}
            {geometry.bars.map((bar, i) =>
              i % geometry.labelEvery === 0 ? (
                <text
                  key={weeks[i].weekStart}
                  x={bar.centerX}
                  y={CHART_H - 6}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#64748b"
                >
                  {formatWeekLabel(weeks[i].weekStart)}
                </text>
              ) : null,
            )}

            {/* hover/focus hit targets: full band height, wider than the bar */}
            {geometry.bars.map((bar, i) => (
              <rect
                key={weeks[i].weekStart}
                x={bar.bandX}
                y={PAD_TOP}
                width={geometry.band}
                height={geometry.innerH}
                fill="transparent"
                tabIndex={0}
                aria-label={`Week of ${formatWeekLabelFull(weeks[i].weekStart)}: ${weeks[i].totalKm.toFixed(1)} km`}
                onPointerEnter={() => setHovered(i)}
                onPointerLeave={() => setHovered(null)}
                onFocus={() => setHovered(i)}
                onBlur={() => setHovered(null)}
                style={{ outline: 'none' }}
              />
            ))}
          </svg>

          {/* tooltip */}
          {hovered !== null && geometry.bars[hovered] && (
            <div
              className="pointer-events-none absolute top-0 -translate-x-1/2 -translate-y-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 shadow-lg"
              style={{
                left: `${(geometry.bars[hovered].centerX / CHART_W) * 100}%`,
                top: `${(geometry.bars[hovered].y / CHART_H) * 100}%`,
              }}
            >
              <div className="whitespace-nowrap text-sm font-semibold text-slate-100">
                {weeks[hovered].totalKm.toFixed(1)} km
              </div>
              <div className="whitespace-nowrap text-xs text-slate-400">
                Week of {formatWeekLabelFull(weeks[hovered].weekStart)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
