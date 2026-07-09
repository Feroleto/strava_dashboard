import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  WORKOUT_META,
  formatDayMonth,
  formatDuration,
  formatDurationShort,
  formatKm,
  formatPace,
} from './activityFormat';
import WeeklyChart, { type Period, type WeekAgg } from './WeeklyChart';
import SegmentedControl from './SegmentedControl';
import SyncPanel from './SyncPanel';

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
  ['ALL', 'Todas'],
  ['EASY_OR_LONG', 'Fácil/longa'],
  ['INTERVAL', 'Intervalo'],
  ['HILL_REPEATS', 'Subida'],
];

const MAX_WEEKS = 26;
const SHOWN_WEEK_GROUPS = 5;

interface WeekWithRuns extends WeekAgg {
  runs: Activity[];
}

function mondayOfCurrentWeek(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function aggregateWeeks(
  activities: Activity[],
  n: number,
  type: TypeFilter,
): WeekWithRuns[] {
  const monday = mondayOfCurrentWeek();
  const weeks: WeekWithRuns[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const start = new Date(monday);
    start.setDate(start.getDate() - 7 * i);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const runs = activities.filter((a) => {
      const date = new Date(a.startDate);
      return (
        date >= start &&
        date < end &&
        (type === 'ALL' || a.workoutType === type)
      );
    });
    weeks.push({
      start,
      km: runs.reduce((s, a) => s + (a.distanceKm ?? 0), 0),
      sec: runs.reduce((s, a) => s + a.movingTimeSec, 0),
      count: runs.length,
      runs,
    });
  }
  return weeks;
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
  const navigate = useNavigate();
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    localStorage.getItem('theme') === 'dark' ? 'dark' : 'light',
  );
  const [period, setPeriod] = useState<Period>('12');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [peekId, setPeekId] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  // fetch the whole 26-week window once; period/type are applied client-side
  useEffect(() => {
    const from = mondayOfCurrentWeek();
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

  const n = parseInt(period, 10);

  const weeks = useMemo(
    () => aggregateWeeks(activities, n, typeFilter),
    [activities, n, typeFilter],
  );

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
    const inPeriod = periodStart
      ? activities.filter((a) => new Date(a.startDate) >= periodStart)
      : [];
    const counts: Record<string, number> = { ALL: inPeriod.length };
    for (const a of inPeriod) {
      counts[a.workoutType] = (counts[a.workoutType] ?? 0) + 1;
    }
    return counts;
  }, [activities, weeks]);

  const weekGroups = useMemo(
    () => [...weeks].reverse().filter((w) => w.count > 0),
    [weeks],
  );
  const shownGroups = weekGroups.slice(0, SHOWN_WEEK_GROUPS);
  const hiddenWeeks = weekGroups.length - shownGroups.length;

  const avgPace = totals.km > 0 ? totals.sec / totals.km : null;

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
          Corridas
        </div>
        <div className="mt-[3px] text-[13px] text-muted-foreground">
          Últimas {n} semanas
        </div>

        <div className="mt-8">
          <div className="text-[52px] leading-none font-bold tracking-[-.03em] text-foreground">
            {formatKm(totals.km)}
          </div>
          <div className="mt-1.5 text-[13.5px] text-muted-foreground">
            km percorridos no período
          </div>
        </div>

        <div className="mt-7 border-t border-border">
          <RailStat label="Atividades" value={String(totals.count)} />
          <RailStat label="Pace médio" value={formatPace(avgPace)} />
          <RailStat label="Tempo total" value={formatDuration(totals.sec)} />
          <RailStat
            label="Elevação"
            value={`${Math.round(totals.elev).toLocaleString('pt-BR')} m`}
          />
        </div>

        <div className="mt-[26px]">
          <div className="mb-2.5 text-[11.5px] font-medium tracking-[.05em] uppercase text-muted-foreground">
            Tipo de treino
          </div>
          <div className="flex flex-col gap-1.5">
            {TYPE_OPTIONS.map(([key, label]) => {
              const active = typeFilter === key;
              return (
                <button
                  key={key}
                  onClick={() => setTypeFilter(key)}
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
              ['light', 'Claro'],
              ['dark', 'Escuro'],
            ]}
            active={theme}
            onPick={setTheme}
          />
        </div>
      </div>

      {/* right panel: list view */}
      <div className="min-w-0">
        <WeeklyChart
          weeks={weeks}
          totalKm={totals.km}
          period={period}
          onPeriodChange={(p) => setPeriod(p)}
        />

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
                    Semana de {formatDayMonth(week.start)}
                  </div>
                  <div className="text-[12.5px] text-muted-foreground">
                    {week.count} corrida{week.count === 1 ? '' : 's'} ·{' '}
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
                          onClick={() => navigate(`/activities/${a.id}`)}
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
                            transform: peek ? 'rotate(90deg)' : 'rotate(0deg)',
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
                            label="Elevação"
                            value={
                              a.elevationGainM != null
                                ? `${Math.round(a.elevationGainM)} m`
                                : '—'
                            }
                          />
                          <PeekCard
                            label="FC média"
                            value={
                              a.averageBpm != null
                                ? `${Math.round(a.averageBpm)} bpm`
                                : '—'
                            }
                          />
                          <PeekCard
                            label="FC máx"
                            value={
                              a.maxBpm != null
                                ? `${Math.round(a.maxBpm)} bpm`
                                : '—'
                            }
                          />
                          <PeekCard
                            label="Cadência"
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
            {hiddenWeeks > 0 && (
              <div className="text-[12.5px] text-muted-foreground">
                + {hiddenWeeks} semana{hiddenWeeks === 1 ? '' : 's'} anterior
                {hiddenWeeks === 1 ? '' : 'es'} no período
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
