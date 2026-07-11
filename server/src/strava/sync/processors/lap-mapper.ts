import { LapType } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { MappedLap } from '../types';
import { StravaLap, StravaSplitMetric } from '../strava-api.types';
import { DetectedLap } from '../detectors/base-detector';

type ActivityLapCreate = Prisma.ActivityLapCreateManyInput;

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// 1km metric splits mapped as laps — used both as the lap source for steady
// runs recorded directly on the Strava app (no watch laps) and as the
// fallback when the structured-workout detector finds no laps.
// splits_metric never carries max_heartrate, so maxHr stays null
export function buildLapsFromSplits(
  activityId: string,
  splits: StravaSplitMetric[],
  lapType: LapType,
): ActivityLapCreate[] {
  return splits
    .filter((s) => (s.distance ?? 0) > 0)
    .map((s) => {
      const distance    = s.distance ?? 0;
      const movingTime  = s.moving_time ?? 0;
      const elapsedTime = s.elapsed_time ?? movingTime;

      const avgSpeed =
        s.average_speed ?? (movingTime > 0 ? distance / movingTime : 0);
      const elevGain = s.elevation_difference ?? 0;

      return {
        activityId,
        lapType,
        lapIndex: s.split,
        startSec: 0,
        endSec: 0,
        distanceM: round1(distance),
        totalDurationSec: elapsedTime,
        movingDurationSec: movingTime,
        avgPaceSecKm: avgSpeed > 0.3 ? 1000 / avgSpeed : 0,
        avgHr: round1(s.average_heartrate ?? 0),
        maxHr: null,
        elevGainM: round1(elevGain),
        avgGradePercent:
          distance > 0 ? round1((elevGain / distance) * 100) : 0,
        vam:
          movingTime > 0 && elevGain > 0
            ? Math.round((elevGain / movingTime) * 3600)
            : 0,
      };
    });
}

// net elevation change (can be negative on downhill laps), derived from the
// altitude stream since Strava's recorded-lap objects only expose cumulative gain
export function lapElevationGain(altStream: number[], lap: StravaLap): number {
  const startAlt = altStream[lap.start_index ?? -1];
  const endAlt = altStream[lap.end_index ?? -1];
  return startAlt != null && endAlt != null ? endAlt - startAlt : 0;
}

export function mapRecordedLap(
  lap: StravaLap,
  index: number,
  altStream: number[],
): MappedLap {
  const avgSpeed = lap.average_speed ?? 0;
  const distance = lap.distance ?? 0;
  const duration = lap.moving_time ?? 0;
  const elevGain = lapElevationGain(altStream, lap);

  return {
    lapIndex: lap.lap_index ?? index + 1,
    avgSpeed,
    avgPace: avgSpeed > 0.3 ? 1000 / avgSpeed : 0,
    distanceM: round1(distance),
    totalDurationSec: lap.elapsed_time ?? duration,
    movingDurationSec: duration,
    startSec: lap.start_index ?? 0,
    endSec: lap.end_index ?? 0,
    avgHr: round1(lap.average_heartrate ?? 0),
    maxHr: lap.max_heartrate ?? null,
    elevGainM: round1(elevGain),
    avgGradePercent:
      distance > 0 ? round1((elevGain / distance) * 100) : 0,
    vam:
      duration > 0 && elevGain > 0
        ? Math.round((elevGain / duration) * 3600)
        : 0,
    avgCadence: lap.average_cadence != null ? lap.average_cadence * 2 : null,
  };
}

export function recordedLapToCreateData(
  activityId: string,
  lapType: LapType,
  lap: MappedLap,
): ActivityLapCreate {
  return {
    activityId,
    lapType,
    lapIndex: lap.lapIndex,
    startSec: lap.startSec,
    endSec: lap.endSec,
    distanceM: lap.distanceM,
    totalDurationSec: lap.totalDurationSec,
    movingDurationSec: lap.movingDurationSec,
    avgPaceSecKm: lap.avgPace,
    avgHr: lap.avgHr,
    maxHr: lap.maxHr,
    elevGainM: lap.elevGainM,
    avgGradePercent: lap.avgGradePercent,
    vam: lap.vam,
    avgCadence: lap.avgCadence,
  };
}

export function detectedLapToCreateData(
  activityId: string,
  lap: DetectedLap,
  idx: number,
): ActivityLapCreate {
  return {
    activityId,
    lapType: lap.type as LapType,
    lapIndex: lap.lapIndex ?? idx + 1,
    startSec: lap.startSec,
    endSec: lap.endSec,
    distanceM: lap.distanceM,
    totalDurationSec: lap.totalDurationSec,
    movingDurationSec: lap.movingDurationSec,
    avgPaceSecKm: lap.avgPace,
    avgHr: lap.avgHr,
    maxHr: lap.maxHr,
    elevGainM: lap.elevGainM,
    avgGradePercent: lap.avgGradePercent,
    vam: lap.vam,
  };
}
