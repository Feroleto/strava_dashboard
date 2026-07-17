import type { BinAgg, Granularity } from './WeeklyChart';
import type { DateRange } from './DateRangePicker';
import type { Activity } from '@/lib/types';
import { formatDayMonth, formatMonthLong } from '@/lib/activityFormat';

export type TypeFilter = 'ALL' | 'EASY_OR_LONG' | 'INTERVAL' | 'HILL_REPEATS';

// second tuple element is a dashboard.json key, translated at render time
export const TYPE_OPTIONS: [TypeFilter, string][] = [
  ['ALL', 'typeOptions.all'],
  ['EASY_OR_LONG', 'typeOptions.easyLong'],
  ['INTERVAL', 'typeOptions.interval'],
  ['HILL_REPEATS', 'typeOptions.hillRepeats'],
];

// chart-only cap for the "All" period; stats and list still cover the full history
export const CHART_MAX_WEEKS = 70;
export const WEEKS_PER_PAGE = 4;
export const DAY_MS = 86_400_000;
export const MONTHLY_THRESHOLD_DAYS = 200;

export interface BinWithRuns extends BinAgg {
  runs: Activity[];
}

export function startOfBin(date: Date, granularity: Granularity): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  if (granularity === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  else d.setDate(1);
  return d;
}

export function nextBin(start: Date, granularity: Granularity): Date {
  const d = new Date(start);
  if (granularity === 'week') d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function aggregateBins(
  activities: Activity[],
  type: TypeFilter,
  granularity: Granularity,
  from: Date,
  until: Date,
): BinWithRuns[] {
  const bins: BinWithRuns[] = [];
  for (
    let start = startOfBin(from, granularity);
    start <= until;
    start = nextBin(start, granularity)
  ) {
    const end = nextBin(start, granularity);
    const runs = activities.filter((a) => {
      const date = new Date(a.startDate);
      return (
        date >= start &&
        date < end &&
        (type === 'ALL' || a.workoutType === type)
      );
    });
    bins.push({
      start,
      km: runs.reduce((s, a) => s + (a.distanceKm ?? 0), 0),
      sec: runs.reduce((s, a) => s + a.movingTimeSec, 0),
      count: runs.length,
      runs,
    });
  }
  return bins;
}

export function aggregateWeeks(
  activities: Activity[],
  n: number,
  type: TypeFilter,
): BinWithRuns[] {
  const monday = startOfBin(new Date(), 'week');
  const from = new Date(monday);
  from.setDate(from.getDate() - 7 * (n - 1));
  return aggregateBins(activities, type, 'week', from, monday);
}

// "June 2026" if is exactly one month range, else "01/04 – 15/05"
export function formatRangeLabel(range: DateRange): string {
  const start = new Date(range.start);
  const lastDay = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  if (start.getDate() === 1 && range.end === lastDay.getTime()) {
    return formatMonthLong(start);
  }
  return `${formatDayMonth(start)} – ${formatDayMonth(new Date(range.end))}`;
}
