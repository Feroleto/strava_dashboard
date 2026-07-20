import type { ActivityStreamPoint, LapSizeMode, LapType } from '@/lib/types';

// Client-side mirror of the backend's sequential walk (server/src/activities/
// lap-editor/lap-editor.service.ts) — used only to resolve distance/time
// boundaries for the live progress bar. The backend recomputes everything
// (pace/HR/elevation/etc) authoritatively from the same stream at save time;
// this file never touches those stats, only distance/position.

export interface WorkingLap {
  key: string;
  lapType: LapType;
  sizeMode: LapSizeMode;
  // meters when sizeMode is 'distance', seconds when 'time'
  sizeValue: number;
}

export interface ResolvedLap extends WorkingLap {
  startIdx: number;
  endIdx: number;
  distanceM: number;
}

export interface LapEditorProgress {
  coveredM: number;
  totalM: number;
  isComplete: boolean;
  deficitM: number;
}

// Moves the lap `key` to sit where `beforeKey` currently is, preserving
// every other lap's relative order. No-ops (returns the same array
// reference) if either key is missing or they're the same — safe to call
// on every pointermove while dragging without extra guards at the callsite.
export function reorderLaps(
  laps: WorkingLap[],
  key: string,
  beforeKey: string,
): WorkingLap[] {
  if (key === beforeKey) return laps;
  const fromIndex = laps.findIndex((l) => l.key === key);
  const targetIndex = laps.findIndex((l) => l.key === beforeKey);
  if (fromIndex === -1 || targetIndex === -1) return laps;

  const next = [...laps];
  const [item] = next.splice(fromIndex, 1);
  const insertAt = next.findIndex((l) => l.key === beforeKey);
  next.splice(insertAt, 0, item);
  return next;
}

// Mirrors the backend's COVERAGE_TOLERANCE_SEC (server/src/activities/
// lap-editor/lap-editor.service.ts) — keep both in sync. Laps sourced from
// Strava's own metric splits don't always sum exactly to the activity's
// true recorded distance (real imprecision in the source data, not
// something the walk introduces), so the last lap absorbs a shortfall up
// to this many seconds of stream instead of it reading as an unreachable
// gap the user has no way to close by hand.
const COVERAGE_TOLERANCE_SEC = 60;

// First point (from startIdx on) whose distance since `anchorDist` reaches
// `targetM`, or the last point if the stream runs out first.
function findDistanceIdx(
  points: ActivityStreamPoint[],
  startIdx: number,
  anchorDist: number,
  targetM: number,
): number {
  for (let idx = startIdx; idx < points.length; idx++) {
    if (points[idx].distanceTotalM - anchorDist >= targetM) {
      return idx;
    }
  }
  return points.length - 1;
}

export function resolveWorkingLaps(
  points: ActivityStreamPoint[],
  laps: WorkingLap[],
): { resolved: ResolvedLap[]; coveredIdx: number; overflowed: boolean } {
  const resolved: ResolvedLap[] = [];
  let cursorIdx = 0;
  let overflowed = false;

  // Distance-mode laps target a *cumulative* distance measured from a fixed
  // anchor (reset every time a time-mode lap gives us an exact index), not
  // "sizeValue meters from wherever the previous lap actually ended". The
  // search for "first point >= target" almost always overshoots its target
  // by a little (real per-second distance deltas are a few meters, so exact
  // hits are rare) — targeting a relative sizeValue from the previous lap's
  // already-overshot end compounds that overshoot lap after lap, and the
  // last lap absorbs the accumulated slack, reading short. Targeting an
  // absolute cumulative distance from a fixed anchor bounds every lap's
  // overshoot to its own single quantization step, independent of how the
  // others resolved.
  let anchorIdx = 0;
  let cumulativeDistM = 0;

  for (let i = 0; i < laps.length; i++) {
    const lap = laps[i];

    // no stream at all, or an earlier lap already consumed every point —
    // there's no real room left for this one. Clamp to the last valid index
    // (points.length itself is out of bounds) so consumers can safely index
    // into `points` for display; distanceM stays 0 since nothing new is
    // actually covered. Flagged via `overflowed` so completion/Save don't
    // read this degenerate state as "done".
    if (points.length === 0 || cursorIdx > points.length - 1) {
      const lastIdx = Math.max(points.length - 1, 0);
      resolved.push({ ...lap, startIdx: lastIdx, endIdx: lastIdx, distanceM: 0 });
      overflowed = true;
      continue;
    }

    const startIdx = cursorIdx;
    let endIdx: number;

    if (lap.sizeMode === 'time') {
      endIdx = Math.min(startIdx + Math.round(lap.sizeValue) - 1, points.length - 1);
      // exact index arithmetic, no drift — re-anchor here so the next
      // distance-mode lap (if any) starts accumulating from this point
      anchorIdx = Math.min(endIdx + 1, points.length - 1);
      cumulativeDistM = 0;
    } else {
      cumulativeDistM += lap.sizeValue;
      const anchorDist = points[anchorIdx].distanceTotalM;
      endIdx = findDistanceIdx(points, startIdx, anchorDist, cumulativeDistM);
    }

    // last lap in the list: absorb a small leftover instead of leaving it
    // as a gap the user has no reasonable way to close by hand — see
    // COVERAGE_TOLERANCE_SEC
    if (i === laps.length - 1) {
      const residual = points.length - 1 - endIdx;
      if (residual > 0 && residual <= COVERAGE_TOLERANCE_SEC) {
        endIdx = points.length - 1;
      }
    }

    const distanceM = points[endIdx].distanceTotalM - points[startIdx].distanceTotalM;

    resolved.push({ ...lap, startIdx, endIdx, distanceM });
    cursorIdx = endIdx + 1;
  }

  return { resolved, coveredIdx: cursorIdx, overflowed };
}

export function computeProgress(
  points: ActivityStreamPoint[],
  laps: WorkingLap[],
): LapEditorProgress {
  if (points.length === 0) {
    return { coveredM: 0, totalM: 0, isComplete: false, deficitM: 0 };
  }

  const { resolved, coveredIdx, overflowed } = resolveWorkingLaps(points, laps);
  const coveredM = resolved.reduce((sum, r) => sum + r.distanceM, 0);
  const totalM = points[points.length - 1].distanceTotalM - points[0].distanceTotalM;
  // overflowed means at least one lap had no room left (a previous lap —
  // or the sequence as a whole — already reached the end of the stream) —
  // never "complete" even though coveredIdx still reads points.length
  const isComplete = coveredIdx === points.length && !overflowed;

  // completion is decided by index coverage alone (every second belongs to
  // exactly one lap, same convention as the backend and as the existing
  // splitIntoKm detector) — summing each lap's own edge-to-edge distance
  // loses the single-second gap "spent" transitioning between laps at every
  // boundary, so a fully-covered set can read a few meters short of totalM.
  // Once coverage is complete that gap isn't a real shortfall, so show the
  // exact total instead of the lossy sum to avoid a confusing near-full bar.
  return {
    coveredM: isComplete ? totalM : coveredM,
    totalM,
    isComplete,
    deficitM: isComplete ? 0 : Math.max(totalM - coveredM, 0),
  };
}
