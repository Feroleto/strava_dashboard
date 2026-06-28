import { LapType } from '@prisma/client';

const WORKOUT_LABEL: LapType = LapType.WORKOUT;
const REST_LABEL: LapType = LapType.REST;
const STEADY_LABEL: LapType = LapType.STEADY;
const WARMUP_LABEL: LapType = LapType.WARMUP;
const COOLDOWN_LABEL: LapType = LapType.COOLDOWN;

const INTERVAL_WORKOUT_SCORE = 0.45;
const INTERVAL_REST_SCORE    = -0.5;
const HILL_WORKOUT_SCORE     = 0.5;
const HILL_REST_SCORE        = -0.5;

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[], mu: number): number {
  const variance =
    arr.reduce((sum, v) => sum + (v - mu) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

// Interval lap classifier
export function classifyIntervalLapsType(
  laps: Array<{ avgSpeed: number }>,
): LapType[] {
  if (laps.length <= 1) return [LapType.RUN];

  const speeds    = laps.map((l) => l.avgSpeed);
  const mu        = mean(speeds);
  const sigma     = stdDev(speeds, mu);

  if (sigma < 0.1) return Array(laps.length).fill(LapType.RUN);

  const initialLabels = speeds.map((s) => {
    const z = (s - mu) / sigma;
    if (z > INTERVAL_WORKOUT_SCORE) return WORKOUT_LABEL;
    if (z < INTERVAL_REST_SCORE)    return REST_LABEL;
    return STEADY_LABEL;
  });

  // first WORKOUT index - everything before is WARMUP
  const firstWorkout = initialLabels.findIndex((l) => l === WORKOUT_LABEL);

  // last WORKOUT or REST index - everything after is COOLDOWN
  let lastWorkout = -1;
  for (let i = initialLabels.length - 1; i >= 0; i--) {
    if (
      initialLabels[i] === WORKOUT_LABEL ||
      initialLabels[i] === REST_LABEL
    ) {
      lastWorkout = i;
      break;
    }
  }

  return initialLabels.map((label, i) => {
    if (firstWorkout !== -1 && i < firstWorkout) return WARMUP_LABEL;
    if (lastWorkout  !== -1 && i > lastWorkout)  return COOLDOWN_LABEL;

    if (label === STEADY_LABEL) {
      const z = (speeds[i] - mu) / sigma;
      return z > 0 ? 'RUN' : REST_LABEL;
    }

    return label;
  });
}

// Hill lap classifier
export function classifyHillLapsType(
  laps: Array<{ vam: number }>,
): LapType[] {
  if (laps.length <= 1) return [LapType.RUN];

  const vams   = laps.map((l) => l.vam);
  const mu     = mean(vams);
  const sigma  = stdDev(vams, mu);

  // if elevation variation is minimal - not a hill workout
  if (sigma < 50) return Array(laps.length).fill(LapType.RUN);

  const initialLabels = vams.map((v) => {
    const z = (v - mu) / sigma;
    if (z > HILL_WORKOUT_SCORE) return WORKOUT_LABEL;
    if (z < HILL_REST_SCORE)    return REST_LABEL;
    return STEADY_LABEL;
  });

  const firstWorkout = initialLabels.findIndex((l) => l === WORKOUT_LABEL);

  let lastWorkout = -1;
  for (let i = initialLabels.length - 1; i >= 0; i--) {
    if (initialLabels[i] === WORKOUT_LABEL) {
      lastWorkout = i + 1; // Python does + 1 here
      break;
    }
  }

  return initialLabels.map((label, i) => {
    if (firstWorkout !== -1 && i < firstWorkout) return WARMUP_LABEL;
    if (lastWorkout  !== -1 && i > lastWorkout)  return COOLDOWN_LABEL;

    if (label === STEADY_LABEL) {
      const z = (vams[i] - mu) / sigma;
      return z > 0 ? 'RUN' : REST_LABEL;
    }

    return label;
  });
}