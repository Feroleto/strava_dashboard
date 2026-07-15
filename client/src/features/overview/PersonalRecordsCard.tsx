import { useEffect, useState } from 'react';
import type { Activity, PersonalBestRecord } from '@/lib/types';
import {
  formatDurationShort,
  formatKm,
  formatHms,
  formatMonthDayYear,
  formatPace,
} from '@/lib/activityFormat';
import { API_BASE_URL } from '@/lib/apiUrl';

interface PersonalRecordsCardProps {
  activities: Activity[];
}

const DISTANCES: { key: string; chip: string; title: string }[] = [
  { key: '400m', chip: '400M', title: '400m' },
  { key: '1/2 mile', chip: '½ MI', title: '1/2 mile' },
  { key: '1k', chip: '1K', title: '1k' },
  { key: '1 mile', chip: '1 MI', title: '1 mile' },
  { key: '2 mile', chip: '2 MI', title: '2 miles' },
  { key: '5k', chip: '5K', title: '5k' },
  { key: '10k', chip: '10K', title: '10k' },
  { key: '15k', chip: '15K', title: '15k' },
  { key: '10 mile', chip: '10 MI', title: '10 miles' },
  { key: '20k', chip: '20K', title: '20k' },
  { key: 'half-marathon', chip: 'HM', title: 'Half marathon' },
  { key: 'marathon', chip: 'MAR', title: 'Marathon' },
];

const COLUMNS = 3;
const PER_COLUMN = Math.ceil(DISTANCES.length / COLUMNS);

function Chip({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <div
      className={`flex h-[34px] w-[42px] flex-none items-center justify-center rounded-[10px] text-[10.5px] font-bold ${
        muted ? 'bg-chip text-muted-foreground' : 'text-acc'
      }`}
      style={
        muted
          ? undefined
          : { background: 'color-mix(in oklab, var(--acc) 10%, transparent)' }
      }
    >
      {label}
    </div>
  );
}

function RecordCell({
  def,
  records,
  activityById,
  expanded,
  onToggle,
  last,
}: {
  def: (typeof DISTANCES)[number];
  records: PersonalBestRecord[];
  activityById: Map<string, Activity>;
  expanded: boolean;
  onToggle: () => void;
  last: boolean;
}) {
  const best = records[0];
  const runnersUp = records.slice(1);
  const bestActivity = best ? activityById.get(best.activityId) : undefined;

  return (
    <div className={last ? '' : 'border-b border-border'}>
      <div
        onClick={runnersUp.length > 0 ? onToggle : undefined}
        className={`flex items-center gap-2.5 py-[11px] ${
          runnersUp.length > 0 ? 'cursor-pointer' : ''
        }`}
        aria-expanded={runnersUp.length > 0 ? expanded : undefined}
      >
        <Chip label={def.chip} muted={!best} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-semibold text-foreground">
            {def.title}
          </div>
          {/* name and date on separate lines — the narrow cell can't fit
              both inline, and the date must never be the part that truncates */}
          {best ? (
            <>
              {bestActivity && (
                <div
                  className="mt-[1px] truncate text-[11px] text-muted-foreground"
                  title={bestActivity.name}
                >
                  {bestActivity.name}
                </div>
              )}
              <div className="mt-[1px] text-[11px] whitespace-nowrap text-muted-foreground">
                {formatMonthDayYear(new Date(best.startDate))}
              </div>
            </>
          ) : (
            <div className="mt-[1px] text-[11px] text-muted-foreground">
              no record yet
            </div>
          )}
        </div>
        <div className="flex-none text-right">
          <div className="text-[15px] font-bold text-foreground">
            {best ? formatHms(best.movingTime) : '—'}
          </div>
          {best && (
            <div className="mt-[1px] text-[11px] text-muted-foreground">
              {formatPace(best.movingTime / (best.distance / 1000))}
            </div>
          )}
        </div>
        {runnersUp.length > 0 && (
          <span
            className="flex-none text-[13px] text-muted-foreground transition-transform duration-150"
            style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
          >
            ›
          </span>
        )}
      </div>
      {expanded && (
        <div className="pb-3">
          {runnersUp.map((r) => {
            const activity = activityById.get(r.activityId);
            return (
              <div
                key={r.rank}
                className="flex items-center gap-2 py-[3px] text-[11.5px]"
              >
                <span className="w-[16px] flex-none font-semibold text-muted-foreground">
                  {r.rank}º
                </span>
                <span className="flex-none font-semibold text-foreground">
                  {formatHms(r.movingTime)}
                </span>
                <span
                  className="flex min-w-0 flex-1 items-baseline text-muted-foreground"
                  title={activity?.name}
                >
                  {activity && (
                    <span className="min-w-0 truncate">
                      {activity.name}&nbsp;·&nbsp;
                    </span>
                  )}
                  <span className="flex-none">
                    {formatMonthDayYear(new Date(r.startDate))}
                  </span>
                </span>
                {r.prRank === 1 && (
                  <span
                    className="flex-none rounded-[6px] px-[5px] py-[1px] text-[9.5px] font-bold text-acc"
                    style={{
                      background:
                        'color-mix(in oklab, var(--acc) 10%, transparent)',
                    }}
                    title="PR at the time it was run"
                  >
                    PR
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PersonalRecordsCard({
  activities,
}: PersonalRecordsCardProps) {
  const [records, setRecords] = useState<PersonalBestRecord[]>([]);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/personal-bests`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setRecords)
      .catch(() => setRecords([]));
  }, []);

  const activityById = new Map(activities.map((a) => [a.id, a]));

  const byName = new Map<string, PersonalBestRecord[]>();
  for (const r of records) {
    const key = r.name.toLowerCase();
    const list = byName.get(key) ?? [];
    list.push(r);
    byName.set(key, list);
  }
  for (const list of byName.values()) {
    list.sort((a, b) => a.rank - b.rank);
  }

  const columns = Array.from({ length: COLUMNS }, (_, c) =>
    DISTANCES.slice(c * PER_COLUMN, (c + 1) * PER_COLUMN),
  );

  const longest = activities.reduce<Activity | null>(
    (best, a) => ((a.distanceKm ?? 0) > (best?.distanceKm ?? 0) ? a : best),
    null,
  );

  return (
    <div className="rounded-[12px] border border-border p-[18px_20px]">
      <div className="flex items-center justify-between">
        <div className="text-[13.5px] font-semibold text-foreground">
          Personal records
        </div>
        <div className="text-[11.5px] text-muted-foreground">
          top 3 · all time
        </div>
      </div>

      <div className="mt-1 grid grid-cols-3 gap-x-5">
        {columns.map((defs, c) => (
          <div key={c} className={c > 0 ? 'border-l border-border pl-5' : ''}>
            {defs.map((def, i) => (
              <RecordCell
                key={def.key}
                def={def}
                records={byName.get(def.key) ?? []}
                activityById={activityById}
                expanded={expandedKey === def.key}
                onToggle={() =>
                  setExpandedKey(expandedKey === def.key ? null : def.key)
                }
                last={i === defs.length - 1}
              />
            ))}
          </div>
        ))}
      </div>

      {longest && (
        <div className="flex items-center gap-3 border-t border-border pt-3">
          <div
            className="flex h-[34px] w-[42px] flex-none items-center justify-center rounded-[10px] text-[10.5px] font-bold text-acc"
            style={{
              background: 'color-mix(in oklab, var(--acc) 10%, transparent)',
            }}
          >
            MAX
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-semibold text-foreground">
              Longest run
            </div>
            <div className="mt-[1px] truncate text-[11px] text-muted-foreground">
              {longest.name} · {formatMonthDayYear(new Date(longest.startDate))}
            </div>
          </div>
          <div className="flex-none text-right">
            <div className="text-[15px] font-bold text-foreground">
              {formatKm(longest.distanceKm ?? 0)} km
            </div>
            <div className="mt-[1px] text-[11px] text-muted-foreground">
              {formatDurationShort(longest.movingTimeSec)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
