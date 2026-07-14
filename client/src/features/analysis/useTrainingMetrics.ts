import { useMemo } from 'react';
import type { Activity } from '@/lib/types';
import { aggregateBins, startOfBin } from '@/features/dashboard/bins';
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
  count: number;
  /** sec/km; null if no distance this week */
  pace: number | null;
  /** km from runs with averageBpm < Z2_THRESHOLD_BPM */
  z2Km: number;
  /** # runs this week that have averageBpm != null */
  hrRunCount: number;
  /** weekly HR-based training-load proxy (a.u.), session-RPE-like */
  load: number;
  monotony: number;
  strain: number;
  /** null when the trailing 4-week mean load is 0 */
  acwr: number | null;
  /** current, still-in-progress week */
  isPartial: boolean;
}

// client-side twin of the (deleted) server training-load calculation, but
// using a simpler HR-based session-RPE-like proxy over raw Activity[]
// instead of lap/pace-zone math — computes the full zero-filled weekly
// history once; callers slice by their own period afterwards
export function useTrainingMetrics(activities: Activity[]): WeekMetrics[] {
  return useMemo(() => {
    if (activities.length === 0) return [];

    const earliest = activities.reduce(
      (min, a) => (a.startDate < min ? a.startDate : min),
      activities[0].startDate,
    );
    const from = startOfBin(new Date(earliest), 'week');
    const until = startOfBin(new Date(), 'week');
    const bins = aggregateBins(activities, 'ALL', 'week', from, until);

    const withoutAcwr = bins.map((bin, i) => {
      const pace = bin.km > 0 ? bin.sec / bin.km : null;
      const dailyLoad = [0, 0, 0, 0, 0, 0, 0]; // Mon..Sun
      let z2Km = 0;
      let hrRunCount = 0;
      let load = 0;

      for (const run of bin.runs) {
        const hr = run.averageBpm;
        if (hr != null) {
          hrRunCount++;
          if (hr < Z2_THRESHOLD_BPM) z2Km += run.distanceKm ?? 0;
        }
        const intensity = hr != null ? Math.max(1, (hr - 110) / 12) : 1;
        const runLoad = ((run.movingTimeSec / 60) * intensity) / 10;
        load += runLoad;
        const dow = (new Date(run.startDate).getDay() + 6) % 7;
        dailyLoad[dow] += runLoad;
      }

      const dailyMean = mean(dailyLoad);
      const dailyStd = sampleStd(dailyLoad);
      const monotony = dailyStd > 0 && dailyMean > 0 ? dailyMean / dailyStd : 0;
      const strain = load * monotony;

      return {
        start: bin.start,
        km: bin.km,
        sec: bin.sec,
        count: bin.count,
        pace,
        z2Km,
        hrRunCount,
        load,
        monotony,
        strain,
        isPartial: i === bins.length - 1,
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
  }, [activities]);
}
