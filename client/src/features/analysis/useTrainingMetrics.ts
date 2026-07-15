import { useMemo } from 'react';
import type { ActivityHrZonePoint, ActivityLapPoint } from '@/lib/types';
import { startOfBin, nextBin } from '@/features/dashboard/bins';
import { mean, sampleStd } from './statsMath';

// Strava's zone buckets are always ordered Z1..Z5, 0-based — index 1 is Z2,
// regardless of the athlete's specific bpm boundaries (those already encode
// the athlete's personal Z2 range)
const Z2_ZONE_INDEX = 1;

// no per-user max-HR/zone data is exposed by the backend yet — this is a
// placeholder threshold, replace with the user's real Z2 upper bound once
// /activities or a profile endpoint exposes HR zones/thresholds
const Z2_THRESHOLD_BPM_FALLBACK = 150;

// standard 5-zone model, Z2 upper bound = 70% of max HR (no %maxHR oracle
// exists in the legacy Python pipeline — its ZONES/Z2_MIN/Z2_MAX are pace-based
// cutoffs, not HR-based, so this convention is new)
const Z2_UPPER_PCT_OF_MAX_HR = 0.7;

const CHRONIC_WINDOW_WEEKS = 4;

export interface WeekMetrics {
  start: Date;
  km: number;
  sec: number;
  /** distinct activityId represented in this week's laps */
  count: number;
  /** sec/km; null if no distance this week */
  pace: number | null;
  /** km from laps with avgHr < the Z2 upper bound (real reading, not the 0 sentinel) */
  z2Km: number;
  /** km from laps with a real (non-sentinel) avgHr reading */
  hrKm: number;
  /** weekly HR-based training-load proxy (a.u.), session-RPE-like */
  load: number;
  monotony: number;
  strain: number;
  /** null when the trailing 4-week mean load is 0 */
  acwr: number | null;
  /**
   * Efficiency Factor for this week's Z2 laps: speed (m/min) per bpm — higher
   * is better (aerobic fitness improving at a given HR). null when no Z2 km
   * has a real HR reading this week
   */
  ef: number | null;
  /**
   * seconds in Z2 per Strava's real per-activity zone data (premium only).
   * null when no activity this week has real zone data synced yet — distinct
   * from "0 real seconds in Z2", which is a genuine reading
   */
  z2TimeSec: number | null;
  /** current, still-in-progress week */
  isPartial: boolean;
}

export function z2UpperBpmFor(maxHr: number | null): number {
  return maxHr ? maxHr * Z2_UPPER_PCT_OF_MAX_HR : Z2_THRESHOLD_BPM_FALLBACK;
}

// sourced from ActivityLap (via GET /activities/laps), not whole-activity
// aggregates: a whole-run average HR blends hard reps with recovery jogs into
// one number, which is exactly what undercounts interval/hill weeks (same
// lesson the legacy pipeline/former server training-load calculator learned
// by sourcing pace from splits/laps instead of activity-level fields)
//
// pure (no React) so it can be unit tested without mounting a component;
// useTrainingMetrics below just memoizes it
// per-activity Z2 time from real Strava zone data, keyed by activityId — a
// weekly rollup groups these by the zone row's own activityStartDate, not
// the lap's, so a mis-synced/duplicate lap timestamp can't misattribute an
// activity's real zone data to the wrong week
function bucketHrZonesByActivity(
  hrZones: ActivityHrZonePoint[],
): Map<string, { activityStartDate: string; z2TimeSec: number }> {
  const byActivity = new Map<
    string,
    { activityStartDate: string; z2TimeSec: number }
  >();
  for (const z of hrZones) {
    const entry = byActivity.get(z.activityId) ?? {
      activityStartDate: z.activityStartDate,
      z2TimeSec: 0,
    };
    if (z.zoneIndex === Z2_ZONE_INDEX) entry.z2TimeSec += z.timeSec;
    byActivity.set(z.activityId, entry);
  }
  return byActivity;
}

export function computeWeekMetrics(
  laps: ActivityLapPoint[],
  z2UpperBpm: number,
  hrZones: ActivityHrZonePoint[] = [],
): WeekMetrics[] {
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

  const hrZonesByActivity = bucketHrZonesByActivity(hrZones);
  const hrZonesByWeek = new Map<
    number,
    { activityStartDate: string; z2TimeSec: number }[]
  >();
  for (const entry of hrZonesByActivity.values()) {
    const weekStart = startOfBin(
      new Date(entry.activityStartDate),
      'week',
    ).getTime();
    const bucket = hrZonesByWeek.get(weekStart);
    if (bucket) bucket.push(entry);
    else hrZonesByWeek.set(weekStart, [entry]);
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
    let z2DistM = 0;
    let z2DurationSec = 0;
    let z2HrWeightedSum = 0;

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
      if (hasHr && lap.avgHr < z2UpperBpm) {
        z2Km += lapKm;
        z2DistM += lap.distanceM;
        z2DurationSec += lap.movingDurationSec;
        z2HrWeightedSum += lap.avgHr * lap.movingDurationSec;
      }

      const dow = (new Date(lap.activityStartDate).getDay() + 6) % 7;
      dailyLoad[dow] += lapLoad;
    }

    const dailyMean = mean(dailyLoad);
    const dailyStd = sampleStd(dailyLoad);
    const monotony = dailyStd > 0 && dailyMean > 0 ? dailyMean / dailyStd : 0;
    const strain = load * monotony;
    const pace = km > 0 ? sec / km : null;

    const z2AvgHr = z2DurationSec > 0 ? z2HrWeightedSum / z2DurationSec : null;
    const z2AvgPaceSecKm =
      z2DistM > 0 ? z2DurationSec / (z2DistM / 1000) : null;
    // EF = speed (m/min) per bpm, not the literal "pace/HR": pace (sec/km) is
    // inversely proportional to speed, so dividing pace by HR directly would
    // make the indicator fall as the athlete gets fitter, inverting the trend
    const ef =
      z2AvgHr && z2AvgPaceSecKm
        ? ((1000 / z2AvgPaceSecKm) * 60) / z2AvgHr
        : null;

    const weekHrZones = hrZonesByWeek.get(start.getTime());
    const z2TimeSec = weekHrZones
      ? weekHrZones.reduce((s, e) => s + e.z2TimeSec, 0)
      : null;

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
      ef,
      z2TimeSec,
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
}

export function useTrainingMetrics(
  laps: ActivityLapPoint[],
  maxHr: number | null,
  hrZones: ActivityHrZonePoint[] = [],
): WeekMetrics[] {
  return useMemo(
    () => computeWeekMetrics(laps, z2UpperBpmFor(maxHr), hrZones),
    [laps, maxHr, hrZones],
  );
}
