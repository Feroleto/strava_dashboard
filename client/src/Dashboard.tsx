import { useEffect, useMemo, useState } from 'react';
import {
  WORKOUT_META,
  formatDayMonth,
  formatDuration,
  formatDurationShort,
  formatKm,
  formatMonthLong,
  formatPace,
} from './activityFormat';
import WeeklyChart, {
  type BinAgg,
  type Granularity,
  type Period,
} from './WeeklyChart';
import DateRangePicker, { type DateRange } from './DateRangePicker';
import SegmentedControl from './SegmentedControl';
import SyncPanel from './SyncPanel';
import ActivityDetailView from './ActivityDetailView';

interface Activity {
  id: string;
  name: string;
  workoutType: string;
  startDate: string;
  distanceKm: number | null;
  movingTimeSec: number;
  paceRawSecKm: number | null;
  elevationGainM: number | null;
  averageBpm: number | null;
  maxBpm: number | null;
  averageCadence: number | null;
}

interface ActivitiesResponse {
  items: Activity[];
  total: number;
}

type TypeFilter = 'ALL' | 'EASY_OR_LONG' | 'INTERVAL' | 'HILL_REPEATS';

const TYPE_OPTIONS: [TypeFilter, string][] = [
  ['ALL', 'All'],
  ['EASY_OR_LONG', 'EASY/LONG'],
  ['INTERVAL', 'Interval'],
  ['HILL_REPEATS', 'Hill Repeats'],
];

const MAX_WEEKS = 70;
const WEEKS_PER_PAGE = 4;
const DAY_MS = 86_400_000;
const MONTHLY_THRESHOLD_DAYS = 200;

interface BinWithRuns extends BinAgg {
  runs: Activity[];
}

function startOfBin(date: Date, granularity: Granularity): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  if (granularity === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  else d.setDate(1);
  return d;
}

function nextBin(start: Date, granularity: Granularity): Date {
  const d = new Date(start);
  if (granularity === 'week') d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function aggregateBins(
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

function aggregateWeeks(
  activities: Activity[],
  n: number,
  type: TypeFilter,
): BinWithRuns[] {
  const monday = startOfBin(new Date(), 'week');
  const from = new Date(monday);
  from.setDate(from.getDate() - 7 * (n - 1));
  return aggregateBins(activities, type, 'week', from, monday);
}

/** "Abril de 2026" se o range for exatamente um mês calendário, senão "01/04 – 15/05" */
function formatRangeLabel(range: DateRange): string {
  const start = new Date(range.start);
  const lastDay = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  if (start.getDate() === 1 && range.end === lastDay.getTime()) {
    return formatMonthLong(start);
  }
  return `${formatDayMonth(start)} – ${formatDayMonth(new Date(range.end))}`;
}

function RailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-border py-[13px]">
      <div className="text-[13px] text-muted-foreground">{label}</div>
      <div className="text-[15px] font-semibold text-foreground">{value}</div>
    </div>
  );
}

function PeekCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] bg-chip px-[13px] py-[11px]">
      <div className="text-[11px] tracking-[.03em] uppercase text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-[15px] font-semibold text-foreground">
        {value}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    localStorage.getItem('theme') === 'dark' ? 'dark' : 'light',
  );
  // `period` não muda quando um range custom entra — é ele que volta ao limpar
  const [period, setPeriod] = useState<Period>('12');
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [peekId, setPeekId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [weekPage, setWeekPage] = useState(1);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  // fetch the whole window once; period/type are applied client-side
  useEffect(() => {
    const from = startOfBin(new Date(), 'week');
    from.setDate(from.getDate() - 7 * (MAX_WEEKS - 1));
    const params = new URLSearchParams({
      limit: '1000',
      dateFrom: toISODate(from),
    });
    fetch(`http://localhost:3000/activities?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: ActivitiesResponse) => {
        setActivities(data.items);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const isAll = period === 'all';
  const n = isAll ? MAX_WEEKS : parseInt(period, 10);
  const rangeActive = dateRange != null;
  const rangeDays = dateRange
    ? Math.round((dateRange.end - dateRange.start) / DAY_MS) + 1
    : 0;

  const earliestDate = useMemo(
    () =>
      activities.length > 0
        ? new Date(
            activities.reduce(
              (min, a) => (a.startDate < min ? a.startDate : min),
              activities[0].startDate,
            ),
          )
        : undefined,
    [activities],
  );

  // atividades dentro do range custom (ambas as pontas inclusivas)
  const inRange = useMemo(
    () =>
      dateRange
        ? activities.filter((a) => {
            const t = new Date(a.startDate).getTime();
            return t >= dateRange.start && t < dateRange.end + DAY_MS;
          })
        : activities,
    [activities, dateRange],
  );

  // bins semanais que alimentam a lista e os totais do rail
  const weeks = useMemo(() => {
    if (dateRange) {
      return aggregateBins(
        inRange,
        typeFilter,
        'week',
        new Date(dateRange.start),
        startOfBin(new Date(dateRange.end), 'week'),
      );
    }
    return aggregateWeeks(activities, n, typeFilter);
  }, [activities, inRange, dateRange, n, typeFilter]);

  const chartGranularity: Granularity =
    (rangeActive && rangeDays > MONTHLY_THRESHOLD_DAYS) ||
    (!rangeActive && isAll)
      ? 'month'
      : 'week';

  const chartBins = useMemo(() => {
    if (dateRange) {
      if (chartGranularity === 'week') return weeks;
      return aggregateBins(
        inRange,
        typeFilter,
        'month',
        new Date(dateRange.start),
        startOfBin(new Date(dateRange.end), 'month'),
      );
    }
    if (isAll && earliestDate) {
      // "Tudo": um bin por mês calendário, da primeira atividade até hoje
      return aggregateBins(
        activities,
        typeFilter,
        'month',
        earliestDate,
        startOfBin(new Date(), 'month'),
      );
    }
    return weeks;
  }, [
    dateRange,
    chartGranularity,
    weeks,
    inRange,
    isAll,
    earliestDate,
    activities,
    typeFilter,
  ]);

  const totals = useMemo(() => {
    const runs = weeks.flatMap((w) => w.runs);
    return {
      km: weeks.reduce((s, w) => s + w.km, 0),
      sec: weeks.reduce((s, w) => s + w.sec, 0),
      count: runs.length,
      elev: runs.reduce((s, a) => s + (a.elevationGainM ?? 0), 0),
    };
  }, [weeks]);

  const typeCounts = useMemo(() => {
    const periodStart = weeks[0]?.start;
    const scoped = dateRange
      ? inRange
      : periodStart
        ? activities.filter((a) => new Date(a.startDate) >= periodStart)
        : [];
    const counts: Record<string, number> = { ALL: scoped.length };
    for (const a of scoped) {
      counts[a.workoutType] = (counts[a.workoutType] ?? 0) + 1;
    }
    return counts;
  }, [activities, inRange, dateRange, weeks]);

  const weekGroups = useMemo(
    () => [...weeks].reverse().filter((w) => w.count > 0),
    [weeks],
  );
  const totalWeekPages = Math.max(
    1,
    Math.ceil(weekGroups.length / WEEKS_PER_PAGE),
  );
  // clamp instead of trusting state: a refetch or filter change can shrink the list
  const currentWeekPage = Math.min(weekPage, totalWeekPages);
  const shownGroups = weekGroups.slice(
    (currentWeekPage - 1) * WEEKS_PER_PAGE,
    currentWeekPage * WEEKS_PER_PAGE,
  );
  const olderWeeks = Math.max(
    0,
    weekGroups.length - currentWeekPage * WEEKS_PER_PAGE,
  );

  const avgPace = totals.km > 0 ? totals.sec / totals.km : null;

  const applyRange = (range: DateRange | null) => {
    setDateRange(range);
    setWeekPage(1);
  };

  if (error) {
    return (
      <p className="p-10 text-center text-[13.5px] text-neg">Erro: {error}</p>
    );
  }

  return (
    <div className="mx-auto grid min-h-screen max-w-[1120px] grid-cols-[264px_1fr] gap-11 px-12 pt-10 pb-11 tabular-nums">
      {/* left rail */}
      <div className="flex flex-col">
        <div className="text-2xl font-semibold tracking-[-.02em] text-foreground">
          Runs
        </div>
        <div className="mt-[3px] text-[13px] text-muted-foreground">
          {dateRange
            ? formatRangeLabel(dateRange)
            : isAll
              ? 'All runs'
              : `Last ${n} weeks`}
        </div>

        <div className="mt-8">
          <div className="text-[52px] leading-none font-bold tracking-[-.03em] text-foreground">
            {formatKm(totals.km)}
          </div>
          <div className="mt-1.5 text-[13.5px] text-muted-foreground">
            km covered in this period
          </div>
        </div>

        <div className="mt-7 border-t border-border">
          <RailStat label="Activities" value={String(totals.count)} />
          <RailStat label="Average Pace" value={formatPace(avgPace)} />
          <RailStat label="Total Time" value={formatDuration(totals.sec)} />
          <RailStat
            label="Elevation Gain"
            value={`${Math.round(totals.elev).toLocaleString('pt-BR')} m`}
          />
        </div>

        <div className="mt-[26px]">
          <div className="mb-2.5 text-[11.5px] font-medium tracking-[.05em] uppercase text-muted-foreground">
            Workout Type
          </div>
          <div className="flex flex-col gap-1.5">
            {TYPE_OPTIONS.map(([key, label]) => {
              const active = typeFilter === key;
              return (
                <button
                  key={key}
                  onClick={() => {
                    setTypeFilter(key);
                    setWeekPage(1);
                  }}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-[10px] border px-[13px] py-[9px] text-left text-[13px] font-medium ${
                    active
                      ? 'border-grid-ax bg-card text-foreground'
                      : 'border-transparent text-muted-foreground'
                  }`}
                >
                  <span
                    className="h-[7px] w-[7px] rounded-full"
                    style={{
                      background:
                        key === 'ALL'
                          ? 'var(--muted-foreground)'
                          : WORKOUT_META[key].dot,
                    }}
                  />
                  {label}
                  <span className="ml-auto font-normal text-muted-foreground">
                    {typeCounts[key] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <SyncPanel onSynced={() => setRefreshKey((k) => k + 1)} />

        <div className="mt-auto pt-[30px] self-start">
          <SegmentedControl
            items={[
              ['light', 'Light'],
              ['dark', 'Dark'],
            ]}
            active={theme}
            onPick={setTheme}
          />
        </div>
      </div>

      {/* right panel: detail view swaps in-place with the list */}
      {detailId ? (
        <div className="min-w-0">
          <ActivityDetailView id={detailId} onBack={() => setDetailId(null)} />
        </div>
      ) : (
        <div className="min-w-0">
          <WeeklyChart
            bins={chartBins}
            granularity={chartGranularity}
            totalKm={totals.km}
            period={period}
            onPeriodChange={(p) => {
              setPeriod(p);
              setWeekPage(1);
              setDateRange(null);
            }}
            onSelect={
              isAll && !rangeActive
                ? (ms) => {
                    // drill-down do "Tudo": mês clicado vira range custom
                    const s = new Date(ms);
                    applyRange({
                      start: ms,
                      end: new Date(
                        s.getFullYear(),
                        s.getMonth() + 1,
                        0,
                      ).getTime(),
                    });
                  }
                : undefined
            }
          >
            <DateRangePicker
              range={dateRange}
              onChange={applyRange}
              minDate={earliestDate}
            />
          </WeeklyChart>

          {dateRange && (
            <div className="mb-[26px] flex">
              <div
                className="flex items-center gap-2.5 rounded-full px-3.5 py-[7px]"
                style={{
                  background:
                    'color-mix(in oklab, var(--acc) 10%, transparent)',
                }}
              >
                <span
                  className="text-[12.5px] font-semibold"
                  style={{ color: 'var(--acc-tx)' }}
                >
                  {formatRangeLabel(dateRange)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {totals.count} run{totals.count === 1 ? '' : 's'} ·{' '}
                  {formatKm(totals.km)} km · {rangeDays} day
                  {rangeDays === 1 ? '' : 's'}
                </span>
                <button
                  onClick={() => applyRange(null)}
                  aria-label="Clean custom period"
                  className="cursor-pointer text-[14px] leading-none text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <p className="py-10 text-center text-[13.5px] text-muted-foreground">
              Carregando…
            </p>
          ) : shownGroups.length === 0 ? (
            <p className="py-10 text-center text-[13.5px] text-muted-foreground">
              Nenhuma atividade neste filtro
            </p>
          ) : (
            <>
              {shownGroups.map((week) => (
                <div key={week.start.getTime()} className="mb-[26px]">
                  <div className="flex items-baseline justify-between border-b border-grid-ax pb-[9px]">
                    <div className="text-xs font-semibold tracking-[.04em] uppercase text-muted-foreground">
                      {formatDayMonth(week.start)} –{' '}
                      {formatDayMonth(
                        new Date(
                          week.start.getFullYear(),
                          week.start.getMonth(),
                          week.start.getDate() + 6,
                        ),
                      )}
                    </div>
                    <div className="text-[12.5px] text-muted-foreground">
                      {week.count} run{week.count === 1 ? '' : 's'} ·{' '}
                      {formatKm(week.km)} km
                    </div>
                  </div>
                  {week.runs.map((a) => {
                    const peek = peekId === a.id;
                    const meta = WORKOUT_META[a.workoutType];
                    return (
                      <div key={a.id} className="border-b border-border">
                        <div className="flex items-center">
                          <div
                            onClick={() => {
                              setDetailId(a.id);
                              setPeekId(null);
                            }}
                            className="flex min-w-0 flex-1 cursor-pointer items-center gap-[13px] px-0.5 py-[13px]"
                          >
                            <div
                              className="h-[7px] w-[7px] flex-none rounded-full"
                              style={{ background: meta?.dot }}
                            />
                            <div className="min-w-0 flex-1 text-sm font-semibold text-foreground">
                              {a.name}
                              <span className="font-normal text-muted-foreground">
                                {' '}
                                · {formatDayMonth(new Date(a.startDate))}
                              </span>
                            </div>
                            <div className="w-[72px] text-right text-[13.5px] text-muted-foreground">
                              {a.distanceKm != null
                                ? `${formatKm(a.distanceKm)} km`
                                : '—'}
                            </div>
                            <div className="w-16 text-right text-[13.5px] text-muted-foreground">
                              {formatDurationShort(a.movingTimeSec)}
                            </div>
                            <div className="w-[84px] text-right text-sm font-semibold text-foreground">
                              {formatPace(a.paceRawSecKm)}
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPeekId(peek ? null : a.id);
                            }}
                            className="ml-1 h-[38px] w-[38px] cursor-pointer rounded-[9px] text-[15px] text-muted-foreground transition-transform duration-150 hover:bg-chip"
                            style={{
                              transform: peek
                                ? 'rotate(90deg)'
                                : 'rotate(0deg)',
                            }}
                            aria-label={peek ? 'Fechar resumo' : 'Abrir resumo'}
                            aria-expanded={peek}
                          >
                            ›
                          </button>
                        </div>
                        {peek && (
                          <div className="grid grid-cols-4 gap-2.5 px-5 pt-0.5 pb-4">
                            <PeekCard
                              label="Elevation"
                              value={
                                a.elevationGainM != null
                                  ? `${Math.round(a.elevationGainM)} m`
                                  : '—'
                              }
                            />
                            <PeekCard
                              label="AVG HR"
                              value={
                                a.averageBpm != null
                                  ? `${Math.round(a.averageBpm)} bpm`
                                  : '—'
                              }
                            />
                            <PeekCard
                              label="MAX HR"
                              value={
                                a.maxBpm != null
                                  ? `${Math.round(a.maxBpm)} bpm`
                                  : '—'
                              }
                            />
                            <PeekCard
                              label="Cadence"
                              value={
                                a.averageCadence != null
                                  ? `${Math.round(a.averageCadence)} spm`
                                  : '—'
                              }
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
              {totalWeekPages > 1 && (
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setWeekPage(currentWeekPage - 1)}
                    disabled={currentWeekPage <= 1}
                    className="cursor-pointer rounded-[9px] bg-chip px-[13px] py-[7px] text-[13px] font-medium text-foreground hover:bg-grid-ax disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-chip"
                  >
                    ‹ Recent weeks
                  </button>
                  <span className="text-[12.5px] text-muted-foreground">
                    Page {currentWeekPage} of {totalWeekPages}
                  </span>
                  <button
                    onClick={() => setWeekPage(currentWeekPage + 1)}
                    disabled={currentWeekPage >= totalWeekPages}
                    className="cursor-pointer rounded-[9px] bg-chip px-[13px] py-[7px] text-[13px] font-medium text-foreground hover:bg-grid-ax disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-chip"
                  >
                    Previous weeks ›
                  </button>
                </div>
              )}
              {isAll && !rangeActive && (
                <div className="mt-4 text-center text-[12.5px] text-muted-foreground">
                  {olderWeeks > 0
                    ? `+ ${olderWeeks} previous weeks · Select a month in the graph to filter`
                    : 'Select a month in the graph to filter'}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
