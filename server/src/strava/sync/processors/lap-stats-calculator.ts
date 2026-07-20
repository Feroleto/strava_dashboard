// Pure functions for summarizing a slice of the per-second stream into lap
// statistics. Extracted from BaseDetector.summarizeCommon/HillDetector's
// grade+vam formulas so the same math can be reused by the manual lap editor
// (server/src/activities/lap-editor/), which recomputes stats for arbitrary
// user-defined ranges instead of detector-found blocks.

import { ProcessedSecond } from '../types';

export interface SegmentSummary {
  type: string;
  lapIndex: number | null;
  startSec: number;
  endSec: number;
  totalDurationSec: number;
  movingDurationSec: number;
  distanceM: number;
  avgPace: number;
  avgHr: number;
  maxHr: number | null;
  elevGainM: number;
  avgGradePercent: number;
  vam: number;
  avgCadence: number | null;
}

export function summarizeSegment(
  block: ProcessedSecond[],
  typeLabel: string,
  minSpeedMoving = 0.3,
): SegmentSummary {
  if (!block.length) {
    throw new Error('summarizeSegment called with empty block');
  }

  const startData = block[0];
  const endData = block[block.length - 1];

  const distance = endData.distanceTotalM - startData.distanceTotalM;
  const elevGain = endData.elevationM - startData.elevationM;

  const movingSeconds = block.filter(
    (d) => (d.speedMs ?? 0) > minSpeedMoving,
  ).length;

  const avgSpeed = movingSeconds > 0 ? distance / movingSeconds : 0;
  const avgPace = avgSpeed > 0.3 ? 1000 / avgSpeed : 0;

  const hrValues = block
    .map((d) => d.heartRate)
    .filter((hr) => hr != null && hr > 0);
  const avgHr =
    hrValues.length > 0
      ? hrValues.reduce((a, b) => a + b, 0) / hrValues.length
      : 0;
  const maxHr = hrValues.length > 0 ? Math.max(...hrValues) : null;

  const cadenceValues = block
    .map((d) => d.cadence)
    .filter((c): c is number => c != null);
  const avgCadence =
    cadenceValues.length > 0
      ? Math.round(
          (cadenceValues.reduce((a, b) => a + b, 0) / cadenceValues.length) *
            10,
        ) / 10
      : null;

  return {
    type: typeLabel,
    lapIndex: null,
    startSec: startData.secondIndex,
    endSec: endData.secondIndex,
    totalDurationSec: endData.secondIndex - startData.secondIndex,
    movingDurationSec: movingSeconds,
    distanceM: Math.round(distance * 10) / 10,
    avgPace,
    avgHr: Math.round(avgHr * 10) / 10,
    maxHr,
    elevGainM: Math.round(elevGain * 10) / 10,
    avgGradePercent: 0,
    vam: 0,
    avgCadence,
  };
}

export function computeGradeAndVam(
  block: ProcessedSecond[],
  summary: Pick<SegmentSummary, 'distanceM' | 'movingDurationSec'>,
): { avgGradePercent: number; vam: number } {
  const elevGain = block[block.length - 1].elevationM - block[0].elevationM;
  const distance = summary.distanceM;
  const movingSec = summary.movingDurationSec;

  const avgGradePercent = distance > 0 ? (elevGain / distance) * 100 : 0;
  const vam = movingSec > 0 ? (elevGain / movingSec) * 3600 : 0;

  return {
    avgGradePercent: Math.round(avgGradePercent * 10) / 10,
    vam: Math.round(vam),
  };
}
