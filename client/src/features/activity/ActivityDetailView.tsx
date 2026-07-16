import { useEffect, useState } from 'react';
import {
  WORKOUT_META,
  formatDurationShort,
  formatKm,
  formatMinSec,
  formatPace,
} from '@/lib/activityFormat';
import RouteMap from './RouteMap';
import type { ActivityDetail, ActivityLap } from '@/lib/types';
import { apiFetch } from '@/lib/api';

const MAP_W = 640;
const MAP_H = 240;

const LAP_TYPE_BASE: Record<string, string> = {
  WARMUP: 'Warmup',
  COOLDOWN: 'Cooldown',
  WORKOUT: 'Run',
  REST: 'Rec',
  RUN: 'Volta',
  STEADY: 'Km',
  ACTIVITY: 'Activity',
};

// "Run 1", "Rec 1", "Km 3" — numbered per type; single-occurrence types
// (Warmup, Cooldown) keep the bare label
function lapLabels(laps: ActivityLap[]): string[] {
  const perType: Record<string, number> = {};
  for (const lap of laps) {
    perType[lap.lapType] = (perType[lap.lapType] ?? 0) + 1;
  }
  const counters: Record<string, number> = {};
  return laps.map((lap) => {
    const base = LAP_TYPE_BASE[lap.lapType] ?? lap.lapType;
    counters[lap.lapType] = (counters[lap.lapType] ?? 0) + 1;
    return perType[lap.lapType] > 1 ? `${base} ${counters[lap.lapType]}` : base;
  });
}

function formatDateFull(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
  const time = d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${date.charAt(0).toUpperCase()}${date.slice(1)} · ${time}`;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-[15px] py-[13px] transition-[background] duration-[250ms]">
      <div className="text-[11px] tracking-[.03em] uppercase text-muted-foreground">
        {label}
      </div>
      <div className="mt-[5px] text-[17px] font-semibold text-foreground">
        {value}
      </div>
    </div>
  );
}

interface ActivityDetailViewProps {
  id: string;
  onBack: () => void;
}

export default function ActivityDetailView({
  id,
  onBack,
}: ActivityDetailViewProps) {
  const [activity, setActivity] = useState<ActivityDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setActivity(null);
    apiFetch(`/activities/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: ActivityDetail) => setActivity(data))
      .catch((err) => setError(err.message));
  }, [id]);

  if (error) {
    return (
      <p className="py-10 text-center text-[13.5px] text-neg">Erro: {error}</p>
    );
  }
  if (!activity) {
    return (
      <p className="py-10 text-center text-[13.5px] text-muted-foreground">
        Carregando…
      </p>
    );
  }

  const meta = WORKOUT_META[activity.workoutType];
  const timedLaps = activity.laps.filter((l) => l.avgPaceSecKm > 0);
  const fastestPace =
    timedLaps.length > 0
      ? Math.min(...timedLaps.map((l) => l.avgPaceSecKm))
      : null;
  const labels = lapLabels(activity.laps);

  const stats: [string, string][] = [
    [
      'Distance',
      activity.distanceKm != null ? `${formatKm(activity.distanceKm)} km` : '—',
    ],
    ['Time', formatDurationShort(activity.movingTimeSec)],
    ['Pace', formatPace(activity.paceRawSecKm)],
    [
      'Elevetaion',
      activity.elevationGainM != null
        ? `${Math.round(activity.elevationGainM)} m`
        : '—',
    ],
    [
      'AVG HR',
      activity.averageBpm != null
        ? `${Math.round(activity.averageBpm)} bpm`
        : '—',
    ],
    [
      'MAX HR',
      activity.maxBpm != null ? `${Math.round(activity.maxBpm)} bpm` : '—',
    ],
    [
      'Cadence',
      activity.averageCadence != null
        ? `${Math.round(activity.averageCadence)} spm`
        : '—',
    ],
    ['Best Pace', formatPace(fastestPace)],
  ];

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <button
          onClick={onBack}
          className="cursor-pointer rounded-[9px] bg-chip py-[7px] pr-[13px] pl-2.5 text-[13px] font-medium text-foreground hover:bg-grid-ax"
        >
          ← Return
        </button>
        <div
          className="rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
          style={{ background: meta?.badgeBg, color: meta?.badgeColor }}
        >
          {meta?.label ?? activity.workoutType}
        </div>
      </div>

      <div className="text-[22px] font-semibold tracking-[-.02em] text-foreground">
        {activity.name}
      </div>
      <div className="mt-[3px] text-[13px] text-muted-foreground">
        {formatDateFull(activity.startDate)}
      </div>

      <div className="mt-[22px] grid grid-cols-4 gap-2.5">
        {stats.map(([label, value]) => (
          <StatCard key={label} label={label} value={value} />
        ))}
      </div>

      <div className="mt-[22px] overflow-hidden rounded-[var(--rad)] border border-border bg-card transition-[background] duration-[250ms]">
        {activity.summaryPolyline ? (
          <RouteMap polyline={activity.summaryPolyline} />
        ) : (
          <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="block w-full">
            {[80, 160, 240, 320, 400, 480, 560].map((x) => (
              <line
                key={x}
                x1={x}
                y1="0"
                x2={x}
                y2={MAP_H}
                stroke="var(--border)"
              />
            ))}
            {[60, 120, 180].map((y) => (
              <line
                key={y}
                x1="0"
                y1={y}
                x2={MAP_W}
                y2={y}
                stroke="var(--border)"
              />
            ))}
            <text
              x={MAP_W / 2}
              y={MAP_H / 2 + 4}
              textAnchor="middle"
              fontSize="13"
              fill="var(--muted-foreground)"
            >
              Sem dados de GPS nesta atividade
            </text>
          </svg>
        )}
      </div>

      {activity.laps.length > 0 && (
        <>
          <div className="mt-7 flex items-baseline justify-between border-b border-grid-ax pb-[9px]">
            <div className="text-xs font-semibold tracking-[.04em] uppercase text-muted-foreground">
              Voltas
            </div>
            <div className="text-[12.5px] text-muted-foreground">
              {activity.laps.length}{' '}
              {activity.laps.length === 1 ? 'Lap' : 'Laps'}
            </div>
          </div>
          <div className="flex items-center gap-[13px] px-0.5 pt-[9px] pb-[7px] text-[11px] tracking-[.03em] uppercase text-muted-foreground">
            <div className="w-[22px]">#</div>
            <div className="w-[110px]">Lap</div>
            <div className="flex-1" />
            <div className="w-[66px] text-right">Dist</div>
            <div className="w-14 text-right">Time</div>
            <div className="w-16 text-right">Pace</div>
            <div className="w-11 text-right">SPM</div>
            <div className="w-11 text-right">AVG HR</div>
            <div className="w-11 text-right">MAX HR</div>
          </div>
          {activity.laps.map((lap, i) => (
            <div
              key={lap.id}
              className="flex items-center gap-[13px] border-b border-border px-0.5 py-2.5"
            >
              <div className="w-[22px] text-[12.5px] text-muted-foreground">
                {lap.lapIndex}
              </div>
              <div className="w-[110px] text-[13.5px] font-medium text-foreground">
                {labels[i]}
              </div>
              <div className="h-1.5 flex-1 overflow-hidden rounded-[3px] bg-chip">
                {fastestPace != null && lap.avgPaceSecKm > 0 && (
                  <div
                    className="h-full rounded-[3px]"
                    style={{
                      width: `${((fastestPace / lap.avgPaceSecKm) * 100).toFixed(0)}%`,
                      background:
                        'color-mix(in oklab, var(--acc) 75%, transparent)',
                    }}
                  />
                )}
              </div>
              <div className="w-[66px] text-right text-[13px] text-muted-foreground">
                {(lap.distanceM / 1000).toFixed(2)} km
              </div>
              <div className="w-14 text-right text-[13px] text-muted-foreground">
                {formatMinSec(lap.movingDurationSec)}
              </div>
              <div className="w-16 text-right text-[13.5px] font-semibold text-foreground">
                {formatPace(lap.avgPaceSecKm).replace(' /km', '')}
              </div>
              <div className="w-11 text-right text-[13px] text-muted-foreground">
                {lap.avgCadence > 0 ? Math.round(lap.avgCadence) : '-'}
              </div>
              <div className="w-11 text-right text-[13px] text-muted-foreground">
                {lap.avgHr > 0 ? Math.round(lap.avgHr) : '—'}
              </div>
              <div className="w-11 text-right text-[13px] text-muted-foreground">
                {lap.maxHr != null && lap.maxHr > 0
                  ? Math.round(lap.maxHr)
                  : '—'}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
