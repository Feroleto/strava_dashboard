import { useState } from 'react';
import {
  WORKOUT_META,
  formatDayMonth,
  formatDurationShort,
  formatKm,
  formatPace,
} from '@/lib/activityFormat';
import type { BinWithRuns } from './bins';

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

interface ActivityListProps {
  loading: boolean;
  groups: BinWithRuns[];
  onOpenDetail: (id: string) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** rodapé do modo "Tudo" sem range custom; null oculta */
  allModeFooter: string | null;
}

export default function ActivityList({
  loading,
  groups,
  onOpenDetail,
  currentPage,
  totalPages,
  onPageChange,
  allModeFooter,
}: ActivityListProps) {
  const [peekId, setPeekId] = useState<string | null>(null);

  if (loading) {
    return (
      <p className="py-10 text-center text-[13.5px] text-muted-foreground">
        Carregando…
      </p>
    );
  }
  if (groups.length === 0) {
    return (
      <p className="py-10 text-center text-[13.5px] text-muted-foreground">
        Nenhuma atividade neste filtro
      </p>
    );
  }

  return (
    <>
      {groups.map((week) => (
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
                      onOpenDetail(a.id);
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
                        a.maxBpm != null ? `${Math.round(a.maxBpm)} bpm` : '—'
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
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="cursor-pointer rounded-[9px] bg-chip px-[13px] py-[7px] text-[13px] font-medium text-foreground hover:bg-grid-ax disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-chip"
          >
            ‹ Recent weeks
          </button>
          <span className="text-[12.5px] text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="cursor-pointer rounded-[9px] bg-chip px-[13px] py-[7px] text-[13px] font-medium text-foreground hover:bg-grid-ax disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-chip"
          >
            Previous weeks ›
          </button>
        </div>
      )}
      {allModeFooter != null && (
        <div className="mt-4 text-center text-[12.5px] text-muted-foreground">
          {allModeFooter}
        </div>
      )}
    </>
  );
}
