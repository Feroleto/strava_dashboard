import { useMemo, useState } from 'react';
import { useActivities } from '@/lib/useActivities';
import {
  formatDuration,
  formatKm,
  formatMonthShortYear,
  formatPace,
} from '@/lib/activityFormat';
import RunCalendar from './RunCalendar';
import PersonalRecordsCard from './PersonalRecordsCard';
import ShoesSection from './ShoesSection';

function TotalTile({
  label,
  value,
  sub,
  bordered,
}: {
  label: string;
  value: string;
  sub?: string;
  bordered: boolean;
}) {
  return (
    <div className={`px-[22px] ${bordered ? 'border-l border-border' : ''}`}>
      <div className="text-[10.5px] font-semibold tracking-[.07em] text-muted-foreground uppercase">
        {label}
      </div>
      <div className="mt-[5px] text-[26px] font-bold tracking-[-.02em] text-foreground">
        {value}
      </div>
      {sub && (
        <div className="mt-[3px] text-[11.5px] text-muted-foreground">
          {sub}
        </div>
      )}
    </div>
  );
}

export default function RunOverviewPage() {
  const { activities, error } = useActivities();
  // snapshot "now" once per mount rather than calling Date.now() during
  // render/useMemo (React purity rule) — a stats page doesn't need
  // second-by-second freshness here
  const [now] = useState(() => Date.now());

  const totals = useMemo(() => {
    if (activities.length === 0) return null;

    const totalKm = activities.reduce((s, a) => s + (a.distanceKm ?? 0), 0);
    const totalSec = activities.reduce((s, a) => s + a.movingTimeSec, 0);
    const totalElev = activities.reduce(
      (s, a) => s + (a.elevationGainM ?? 0),
      0,
    );
    const bestElev = activities.reduce(
      (m, a) => Math.max(m, a.elevationGainM ?? 0),
      0,
    );
    const earliest = activities.reduce(
      (min, a) => (a.startDate < min ? a.startDate : min),
      activities[0].startDate,
    );
    const earliestDate = new Date(earliest);
    const weeks = Math.max(
      1,
      (now - earliestDate.getTime()) / (7 * 24 * 60 * 60 * 1000),
    );

    return {
      count: activities.length,
      since: formatMonthShortYear(earliestDate),
      totalKm,
      kmPerWeek: totalKm / weeks,
      totalSec,
      avgPaceSecKm: totalKm > 0 ? totalSec / totalKm : null,
      totalElev,
      bestElev,
    };
  }, [activities, now]);

  if (error) {
    return (
      <p className="p-10 text-center text-[13.5px] text-neg">Error: {error}</p>
    );
  }

  return (
    <div className="p-[30px_34px_34px] tabular-nums">
      <div>
        <h1 className="text-[19px] font-semibold tracking-[-.01em] text-foreground">
          Overview
        </h1>
        <p className="mt-[2px] text-[12.5px] text-muted-foreground">
          Run · all time
        </p>
      </div>

      <div className="mt-6 grid grid-cols-4">
        <TotalTile
          label="Total runs"
          bordered={false}
          value={String(totals?.count ?? 0)}
          sub={totals ? `since ${totals.since}` : undefined}
        />
        <TotalTile
          label="Distance"
          bordered
          value={`${formatKm(totals?.totalKm ?? 0)} km`}
          sub={totals ? `${formatKm(totals.kmPerWeek)} km / week` : undefined}
        />
        <TotalTile
          label="Time"
          bordered
          value={formatDuration(totals?.totalSec ?? 0)}
          sub={totals ? `${formatPace(totals.avgPaceSecKm)} avg` : undefined}
        />
        <TotalTile
          label="Elevation"
          bordered
          value={`${Math.round(totals?.totalElev ?? 0).toLocaleString('en-US')} m`}
          sub={
            totals
              ? `best ${Math.round(totals.bestElev).toLocaleString('en-US')} m in a run`
              : undefined
          }
        />
      </div>

      <div className="mt-[26px] grid grid-cols-[340px_1fr] items-stretch gap-[18px]">
        <RunCalendar activities={activities} />
        <PersonalRecordsCard activities={activities} />
      </div>

      <div className="mt-[26px]">
        <ShoesSection />
      </div>
    </div>
  );
}
