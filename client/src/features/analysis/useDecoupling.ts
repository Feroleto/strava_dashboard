import { useMemo } from 'react';
import type { ActivityLapPoint } from '@/lib/types';

const MIN_DURATION_SEC = 25 * 60;

export interface DecouplingPoint {
  activityId: string;
  date: Date;
  /** % efficiency drop from the first half to the second half of the run;
   * positive = drift (worse), following the standard HR:pace decoupling
   * convention (<5% good, >10% high) */
  decouplingPct: number;
}

function efficiency(distM: number, durationSec: number, hrWeighted: number): number {
  const avgHr = hrWeighted / durationSec;
  const speedMPerMin = (distM / (durationSec / 60));
  return speedMPerMin / avgHr;
}

// splits each STEADY (EASY_OR_LONG) run's laps into a first/second half by
// cumulative distance and compares the pace:HR efficiency ratio between them
// — the per-second stream (ActivitySecond) this would ideally use is only
// ever populated for INTERVAL/HILL activities without recorded laps (~3
// activities), so steady runs only have lap-level granularity available; a
// lap falls entirely into whichever half its cumulative distance-so-far
// hasn't yet crossed the run's midpoint, an acceptable approximation given
// laps are already ~1km
export function computeDecoupling(laps: ActivityLapPoint[]): DecouplingPoint[] {
  const byActivity = new Map<string, ActivityLapPoint[]>();
  for (const lap of laps) {
    if (lap.workoutType !== 'EASY_OR_LONG') continue;
    const group = byActivity.get(lap.activityId);
    if (group) group.push(lap);
    else byActivity.set(lap.activityId, [lap]);
  }

  const points: DecouplingPoint[] = [];

  for (const group of byActivity.values()) {
    const ordered = [...group].sort((a, b) => a.lapIndex - b.lapIndex);
    const totalDurationSec = ordered.reduce((s, l) => s + l.movingDurationSec, 0);
    if (totalDurationSec < MIN_DURATION_SEC) continue;

    const totalDistM = ordered.reduce((s, l) => s + l.distanceM, 0);
    const halfDistM = totalDistM / 2;

    let cumDistM = 0;
    let firstDistM = 0;
    let firstDurationSec = 0;
    let firstHrWeighted = 0;
    let secondDistM = 0;
    let secondDurationSec = 0;
    let secondHrWeighted = 0;

    for (const lap of ordered) {
      const hasHr = lap.avgHr > 0;
      const inFirstHalf = cumDistM < halfDistM;
      cumDistM += lap.distanceM;

      if (!hasHr) continue;
      if (inFirstHalf) {
        firstDistM += lap.distanceM;
        firstDurationSec += lap.movingDurationSec;
        firstHrWeighted += lap.avgHr * lap.movingDurationSec;
      } else {
        secondDistM += lap.distanceM;
        secondDurationSec += lap.movingDurationSec;
        secondHrWeighted += lap.avgHr * lap.movingDurationSec;
      }
    }

    if (firstDurationSec === 0 || secondDurationSec === 0) continue;

    const efFirst = efficiency(firstDistM, firstDurationSec, firstHrWeighted);
    const efSecond = efficiency(secondDistM, secondDurationSec, secondHrWeighted);
    if (efFirst <= 0) continue;

    points.push({
      activityId: ordered[0].activityId,
      date: new Date(ordered[0].activityStartDate),
      decouplingPct: ((efFirst - efSecond) / efFirst) * 100,
    });
  }

  return points.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function useDecoupling(laps: ActivityLapPoint[]): DecouplingPoint[] {
  return useMemo(() => computeDecoupling(laps), [laps]);
}
