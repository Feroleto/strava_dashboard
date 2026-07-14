import { useMemo, useState } from 'react';
import WeeklyChart, { type Granularity, type Period } from './WeeklyChart';
import DateRangePicker, { type DateRange } from './DateRangePicker';
import Rail from './Rail';
import ActivityList from './ActivityList';
import RangeChip from './RangeChip';
import ActivityDetailView from '@/features/activity/ActivityDetailView';
import { useActivities } from '@/lib/useActivities';
import {
  CHART_MAX_WEEKS,
  DAY_MS,
  MONTHLY_THRESHOLD_DAYS,
  WEEKS_PER_PAGE,
  aggregateBins,
  aggregateWeeks,
  formatRangeLabel,
  startOfBin,
  type TypeFilter,
} from './bins';

export default function Dashboard() {
  const [period, setPeriod] = useState<Period>('12');
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [weekPage, setWeekPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const { activities, loading, error } = useActivities(refreshKey);

  const isAll = period === 'all';
  const n = isAll ? 0 : parseInt(period, 10);
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

  // activities in the custom range
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

  // weekly beens
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
    if (isAll) {
      // "All": every week from the first activity to now
      return aggregateBins(
        activities,
        typeFilter,
        'week',
        earliestDate ?? new Date(),
        startOfBin(new Date(), 'week'),
      );
    }
    return aggregateWeeks(activities, n, typeFilter);
  }, [activities, inRange, dateRange, isAll, earliestDate, n, typeFilter]);

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
      // cap the chart at the last 70 weeks so months don't get squeezed;
      // stats/list still cover everything
      const chartFrom = startOfBin(new Date(), 'week');
      chartFrom.setDate(chartFrom.getDate() - 7 * (CHART_MAX_WEEKS - 1));
      return aggregateBins(
        activities,
        typeFilter,
        'month',
        earliestDate > chartFrom ? earliestDate : chartFrom,
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
    <div className="grid grid-cols-[264px_1fr] gap-11 p-10 tabular-nums">
      <Rail
        subtitle={
          dateRange
            ? formatRangeLabel(dateRange)
            : isAll
              ? 'All runs'
              : `Last ${n} weeks`
        }
        totals={totals}
        avgPace={avgPace}
        typeFilter={typeFilter}
        onTypeFilter={(type) => {
          setTypeFilter(type);
          setWeekPage(1);
        }}
        typeCounts={typeCounts}
        onSynced={() => setRefreshKey((k) => k + 1)}
      />

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
            <RangeChip
              label={formatRangeLabel(dateRange)}
              count={totals.count}
              km={totals.km}
              days={rangeDays}
              onClear={() => applyRange(null)}
            />
          )}

          <ActivityList
            loading={loading}
            groups={shownGroups}
            onOpenDetail={setDetailId}
            currentPage={currentWeekPage}
            totalPages={totalWeekPages}
            onPageChange={setWeekPage}
            allModeFooter={
              isAll && !rangeActive
                ? olderWeeks > 0
                  ? `+ ${olderWeeks} previous weeks · Select a month in the graph to filter`
                  : 'Select a month in the graph to filter'
                : null
            }
          />
        </div>
      )}
    </div>
  );
}
