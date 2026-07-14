import { useMemo } from 'react';
import type { ActivityLapPoint } from '@/lib/types';
import { startOfBin, nextBin } from '@/features/dashboard/bins';
import { mean, sampleStd } from './statsMath';

// no per-user max-HR/zone data is exposed by the backend yet — this is a
// placeholder threshold, replace with the user's real Z2 upper bound once
// /activities or a profile endpoint exposes HR zones/thresholds
const Z2_THRESHOLD_BPM = 150;

const CHRONIC_WINDOW_WEEKS = 4;

export interface WeekMetrics {
  start: Date;
  km: number;
  sec: number;
  /** distinct activityId represented in this week's laps */
  count: number;
  /** sec/km; null if no distance this week */
  pace: number | null;
  /** km from laps with avgHr < Z2_THRESHOLD_BPM (real reading, not the 0 sentinel) */
  z2Km: number;
  /** km from laps with a real (non-sentinel) avgHr reading */
  hrKm: number;
  /** weekly HR-based training-load proxy (a.u.), session-RPE-like */
  load: number;
  monotony: number;
  strain: number;
  /** null when the trailing 4-week mean load is 0 */
  acwr: number | null;
  /** current, still-in-progress week */
  isPartial: boolean;
}

// sourced from ActivityLap (via GET /activities/laps), not whole-activity
// aggregates: a whole-run average HR blends hard reps with recovery jogs into
// one number, which is exactly what undercounts interval/hill weeks (same
// lesson the legacy pipeline/former server training-load calculator learned
// by sourcing pace from splits/laps instead of activity-level fields)
export function useTrainingMetrics(laps: ActivityLapPoint[]): WeekMetrics[] {
  return useMemo(() => {
    if (laps.length === 0) return [];

    const earliest = laps.reduce(
      (min, l) => (l.activityStartDate < min ? l.activityStartDate : min),
      laps[0].activityStartDate,
    );
    const from = startOfBin(new Date(earliest), 'week');
    const until = startOfBin(new Date(), 'week');

    const weeks: Date[] = [];
    for (let start = from; start <= until; start = nextBin(start, 'week')) {
      weeks.push(start);
    }

    const byWeek = new Map<number, ActivityLapPoint[]>();
    for (const w of weeks) byWeek.set(w.getTime(), []);
    for (const lap of laps) {
      const weekStart = startOfBin(new Date(lap.activityStartDate), 'week').getTime();
      byWeek.get(weekStart)?.push(lap);
    }

    const withoutAcwr = weeks.map((start, i) => {
      const weekLaps = byWeek.get(start.getTime()) ?? [];
      const dailyLoad = [0, 0, 0, 0, 0, 0, 0]; // Mon..Sun
      const activityIds = new Set<string>();
      let km = 0;
      let sec = 0;
      let z2Km = 0;
      let hrKm = 0;
      let load = 0;

      for (const lap of weekLaps) {
        activityIds.add(lap.activityId);
        const hasHr = lap.avgHr > 0; // 0 is the "no monitor" sentinel, never null
        const intensity = hasHr ? Math.max(1, (lap.avgHr - 110) / 12) : 1;
        const lapKm = lap.distanceM / 1000;
        const lapLoad = ((lap.movingDurationSec / 60) * intensity) / 10;

        km += lapKm;
        sec += lap.movingDurationSec;
        load += lapLoad;
        if (hasHr) hrKm += lapKm;
        if (hasHr && lap.avgHr < Z2_THRESHOLD_BPM) z2Km += lapKm;

        const dow = (new Date(lap.activityStartDate).getDay() + 6) % 7;
        dailyLoad[dow] += lapLoad;
      }

      const dailyMean = mean(dailyLoad);
      const dailyStd = sampleStd(dailyLoad);
      const monotony = dailyStd > 0 && dailyMean > 0 ? dailyMean / dailyStd : 0;
      const strain = load * monotony;
      const pace = km > 0 ? sec / km : null;

      return {
        start,
        km,
        sec,
        count: activityIds.size,
        pace,
        z2Km,
        hrKm,
        load,
        monotony,
        strain,
        isPartial: i === weeks.length - 1,
      };
    });

    return withoutAcwr.map((w, i) => {
      const windowStart = Math.max(0, i - (CHRONIC_WINDOW_WEEKS - 1));
      const window = withoutAcwr.slice(windowStart, i + 1);
      const chronicLoad = mean(window.map((x) => x.load));
      return {
        ...w,
        acwr: chronicLoad > 0 ? w.load / chronicLoad : null,
      };
    });
  }, [laps]);
}
