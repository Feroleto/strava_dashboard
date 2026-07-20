import { describe, it, expect } from 'vitest';
import type { ActivityStreamPoint } from '@/lib/types';
import {
  computeProgress,
  reorderLaps,
  resolveWorkingLaps,
  type WorkingLap,
} from './lapBoundaryMath';

// one point per second, distPerSec meters/sec, indices 0..count-1
function makeStream(count: number, distPerSec: number): ActivityStreamPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    secondIndex: i,
    distanceTotalM: i * distPerSec,
    elevationM: 100,
    heartRate: 140,
    speedMs: distPerSec,
    cadence: 170,
  }));
}

function lap(overrides: Partial<WorkingLap>): WorkingLap {
  return { key: 'k', lapType: 'RUN', sizeMode: 'distance', sizeValue: 100, ...overrides };
}

describe('resolveWorkingLaps — laps that overflow the stream', () => {
  it('does not throw when a lap has no room left after a previous one fills the stream', () => {
    const points = makeStream(100, 4); // 0..396m over 100s
    const laps: WorkingLap[] = [
      lap({ key: 'a', sizeMode: 'distance', sizeValue: 500 }), // consumes the whole stream
      lap({ key: 'b', sizeMode: 'distance', sizeValue: 100 }), // nothing left for this one
    ];

    expect(() => resolveWorkingLaps(points, laps)).not.toThrow();
  });

  it('clamps the overflowed lap to a valid index instead of pointing past the array', () => {
    const points = makeStream(100, 4);
    const laps: WorkingLap[] = [
      lap({ key: 'a', sizeMode: 'distance', sizeValue: 500 }),
      lap({ key: 'b', sizeMode: 'distance', sizeValue: 100 }),
    ];

    const { resolved, overflowed } = resolveWorkingLaps(points, laps);

    expect(overflowed).toBe(true);
    const overflowLap = resolved[1];
    expect(overflowLap.startIdx).toBeLessThan(points.length);
    expect(overflowLap.endIdx).toBeLessThan(points.length);
    expect(overflowLap.distanceM).toBe(0);
    // must stay indexable — this is exactly what LapEditorRow reads to
    // render duration, so it must never be points.length (out of bounds)
    expect(points[overflowLap.startIdx]).toBeDefined();
    expect(points[overflowLap.endIdx]).toBeDefined();
  });

  it('flags overflow even when the total sum happens to land back on points.length', () => {
    const points = makeStream(100, 4);
    const laps: WorkingLap[] = [
      lap({ key: 'a', sizeMode: 'time', sizeValue: 100 }), // exactly fills the stream
      lap({ key: 'b', sizeMode: 'time', sizeValue: 10 }), // no room left, still added
    ];

    const { overflowed } = resolveWorkingLaps(points, laps);
    expect(overflowed).toBe(true);
  });

  it('does not overflow when laps exactly partition the stream', () => {
    const points = makeStream(100, 4);
    const laps: WorkingLap[] = [
      lap({ key: 'a', sizeMode: 'time', sizeValue: 50 }),
      lap({ key: 'b', sizeMode: 'time', sizeValue: 50 }),
    ];

    const { overflowed, coveredIdx } = resolveWorkingLaps(points, laps);
    expect(overflowed).toBe(false);
    expect(coveredIdx).toBe(points.length);
  });

  it('handles an empty stream without throwing', () => {
    expect(() =>
      resolveWorkingLaps([], [lap({ sizeMode: 'distance', sizeValue: 100 })]),
    ).not.toThrow();
  });

  it('absorbs a small trailing shortfall into the last lap', () => {
    // mirrors the real-world case: laps sourced from Strava's own metric
    // splits, opened unedited, whose distances don't sum to exactly the
    // stream's true total — 20 points short here, well within
    // COVERAGE_TOLERANCE_SEC
    const points = makeStream(300, 4);
    const laps: WorkingLap[] = [
      lap({ key: 'a', sizeMode: 'time', sizeValue: 140 }),
      lap({ key: 'b', sizeMode: 'time', sizeValue: 140 }),
    ];

    const { resolved, coveredIdx, overflowed } = resolveWorkingLaps(points, laps);

    expect(overflowed).toBe(false);
    expect(coveredIdx).toBe(points.length);
    expect(resolved[1].endIdx).toBe(points.length - 1);
  });

  it('still reports a real deficit beyond the tolerance, not just absorbs it', () => {
    const points = makeStream(300, 4);
    const laps: WorkingLap[] = [
      lap({ key: 'a', sizeMode: 'distance', sizeValue: 100 }),
      lap({ key: 'b', sizeMode: 'distance', sizeValue: 100 }),
    ];

    const progress = computeProgress(points, laps);
    expect(progress.isComplete).toBe(false);
    expect(progress.deficitM).toBeGreaterThan(0);
  });

  it('does not let overshoot compound across a chain of distance-mode laps', () => {
    // distPerSec (3.7) doesn't divide evenly into the 1000m targets, so
    // every lap's "first point >= target" search necessarily overshoots
    // its own cumulative target by a bit, and a lap's *own* reported
    // distance (its own start to its own end) also absorbs the one-point
    // transition gap from the lap before it — so each lap wobbles a little
    // above or below 1000m, that's expected and bounded (well under
    // 2×distPerSec either way). The bug this guards against is different:
    // resolving each lap's target relative to wherever the *previous* lap
    // actually ended (instead of an absolute cumulative distance from a
    // fixed anchor) let that per-lap wobble compound lap after lap — over
    // 10 laps that drifted by tens of meters, and the last lap absorbed it
    const points = makeStream(4000, 3.7); // 0..14796.3m over 4000s
    const laps: WorkingLap[] = Array.from({ length: 10 }, (_, i) =>
      lap({ key: `k${i}`, sizeMode: 'distance', sizeValue: 1000 }),
    );

    const { resolved, overflowed } = resolveWorkingLaps(points, laps);

    expect(overflowed).toBe(false);
    const distances = resolved.map((r) => r.distanceM);
    // bounded per-lap wobble, not compounding: with the bug, 10 laps at
    // this scale drifted by ~30m; without it, the spread stays well under that
    const spread = Math.max(...distances) - Math.min(...distances);
    expect(spread).toBeLessThan(4 * 3.7);
    distances.forEach((d) => {
      expect(d).toBeGreaterThan(1000 - 3 * 3.7);
      expect(d).toBeLessThan(1000 + 2 * 3.7);
    });
  });
});

describe('computeProgress — overflow disables completion', () => {
  it('is not complete when a lap overflows the stream, even though coveredIdx reads points.length', () => {
    const points = makeStream(100, 4);
    const laps: WorkingLap[] = [
      lap({ key: 'a', sizeMode: 'time', sizeValue: 100 }),
      lap({ key: 'b', sizeMode: 'time', sizeValue: 10 }),
    ];

    expect(computeProgress(points, laps).isComplete).toBe(false);
  });

  it('is complete when laps exactly partition the stream, no overflow', () => {
    const points = makeStream(100, 4);
    const laps: WorkingLap[] = [
      lap({ key: 'a', sizeMode: 'time', sizeValue: 50 }),
      lap({ key: 'b', sizeMode: 'time', sizeValue: 50 }),
    ];

    const progress = computeProgress(points, laps);
    expect(progress.isComplete).toBe(true);
    expect(progress.coveredM).toBe(progress.totalM);
  });
});

describe('reorderLaps', () => {
  const laps: WorkingLap[] = [
    lap({ key: 'a' }),
    lap({ key: 'b' }),
    lap({ key: 'c' }),
    lap({ key: 'd' }),
  ];

  it('moves a lap forward to sit before the target key', () => {
    const result = reorderLaps(laps, 'a', 'c');
    expect(result.map((l) => l.key)).toEqual(['b', 'a', 'c', 'd']);
  });

  it('moves a lap backward to sit before the target key', () => {
    const result = reorderLaps(laps, 'd', 'b');
    expect(result.map((l) => l.key)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('preserves every other lap and its own contents (not just keys)', () => {
    const laps2: WorkingLap[] = [
      lap({ key: 'a', lapType: 'WARMUP', sizeValue: 200 }),
      lap({ key: 'b', lapType: 'WORKOUT', sizeValue: 400 }),
      lap({ key: 'c', lapType: 'REST', sizeValue: 90 }),
    ];
    const result = reorderLaps(laps2, 'c', 'a');
    expect(result).toEqual([
      lap({ key: 'c', lapType: 'REST', sizeValue: 90 }),
      lap({ key: 'a', lapType: 'WARMUP', sizeValue: 200 }),
      lap({ key: 'b', lapType: 'WORKOUT', sizeValue: 400 }),
    ]);
  });

  it('is a no-op (same reference) when the keys are equal', () => {
    const result = reorderLaps(laps, 'b', 'b');
    expect(result).toBe(laps);
  });

  it('is a no-op (same reference) when either key does not exist', () => {
    expect(reorderLaps(laps, 'missing', 'b')).toBe(laps);
    expect(reorderLaps(laps, 'a', 'missing')).toBe(laps);
  });
});
