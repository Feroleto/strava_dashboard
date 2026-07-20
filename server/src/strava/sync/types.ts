// Shared shapes of the sync pipeline: the per-second stream after the SQL
// processing (ProcessedSecond) and the normalized recorded lap (MappedLap)

export interface ProcessedSecond {
  secondIndex: number;
  distanceTotalM: number;
  distanceDeltaM: number;
  speedRaw: number;
  speedMs: number;
  accelerationMs2: number;
  heartRate: number;
  elevationM: number;
  elevationSmooth: number;
  elevationDelta: number;
  gradePercent: number;
  verticalSpeedMs: number;
  paceSeckm: number | null;
  cadence: number | null;
}

export interface MappedLap {
  lapIndex: number;
  avgSpeed: number;
  avgPace: number;
  distanceM: number;
  totalDurationSec: number;
  movingDurationSec: number;
  startSec: number;
  endSec: number;
  avgHr: number;
  maxHr: number | null;
  elevGainM: number;
  avgGradePercent: number;
  vam: number;
  avgCadence: number | null;
}
