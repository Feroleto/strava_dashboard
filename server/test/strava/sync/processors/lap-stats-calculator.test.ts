import { describe, it, expect } from 'vitest';
import {
  computeGradeAndVam,
  summarizeSegment,
} from 'src/strava/sync/processors/lap-stats-calculator';
import { ProcessedSecond } from 'src/strava/sync/types';

function makeSecond(overrides: Partial<ProcessedSecond>): ProcessedSecond {
  return {
    secondIndex: 0,
    distanceTotalM: 0,
    distanceDeltaM: 0,
    speedRaw: 0,
    speedMs: 0,
    accelerationMs2: 0,
    heartRate: 150,
    elevationM: 100,
    elevationSmooth: 100,
    elevationDelta: 0,
    gradePercent: 0,
    verticalSpeedMs: 0,
    paceSeckm: null,
    cadence: null,
    ...overrides,
  };
}

describe('summarizeSegment', () => {
  it('throws on an empty block', () => {
    expect(() => summarizeSegment([], 'RUN')).toThrow();
  });

  it('computes distance, duration and pace from the block edges', () => {
    const block = Array.from({ length: 100 }, (_, i) =>
      makeSecond({ secondIndex: i, distanceTotalM: i * 4, speedMs: 4 }),
    );

    const summary = summarizeSegment(block, 'RUN');

    expect(summary.startSec).toBe(0);
    expect(summary.endSec).toBe(99);
    expect(summary.totalDurationSec).toBe(99);
    expect(summary.movingDurationSec).toBe(100);
    expect(summary.distanceM).toBeCloseTo(396, 0);
    // avgSpeed = distance / movingDurationSec = 396 / 100, not distPerSec
    expect(summary.avgPace).toBeCloseTo(1000 / (396 / 100), 1);
  });

  it('ignores non-positive HR readings (sentinel) when averaging', () => {
    const block = [
      makeSecond({ secondIndex: 0, heartRate: 0 }),
      makeSecond({ secondIndex: 1, heartRate: 140 }),
      makeSecond({ secondIndex: 2, heartRate: 160 }),
    ];

    const summary = summarizeSegment(block, 'RUN');

    expect(summary.avgHr).toBe(150);
    expect(summary.maxHr).toBe(160);
  });

  it('returns null maxHr and 0 avgHr when no HR data is present', () => {
    const block = [
      makeSecond({ secondIndex: 0, heartRate: 0 }),
      makeSecond({ secondIndex: 1, heartRate: 0 }),
    ];

    const summary = summarizeSegment(block, 'RUN');

    expect(summary.avgHr).toBe(0);
    expect(summary.maxHr).toBeNull();
  });

  it('averages non-null cadence readings, ignoring missing ones', () => {
    const block = [
      makeSecond({ secondIndex: 0, cadence: 170 }),
      makeSecond({ secondIndex: 1, cadence: null }),
      makeSecond({ secondIndex: 2, cadence: 180 }),
    ];

    const summary = summarizeSegment(block, 'RUN');

    expect(summary.avgCadence).toBe(175);
  });

  it('returns null avgCadence when no cadence data is present', () => {
    const block = [
      makeSecond({ secondIndex: 0, cadence: null }),
      makeSecond({ secondIndex: 1, cadence: null }),
    ];

    expect(summarizeSegment(block, 'RUN').avgCadence).toBeNull();
  });

  it('allows negative elevGainM on a downhill block', () => {
    const block = [
      makeSecond({ secondIndex: 0, elevationM: 100 }),
      makeSecond({ secondIndex: 1, elevationM: 90 }),
    ];

    expect(summarizeSegment(block, 'RUN').elevGainM).toBe(-10);
  });

  it('defaults avgGradePercent/vam to 0 (computeGradeAndVam not applied)', () => {
    const block = [makeSecond({ secondIndex: 0 }), makeSecond({ secondIndex: 1 })];
    const summary = summarizeSegment(block, 'RUN');

    expect(summary.avgGradePercent).toBe(0);
    expect(summary.vam).toBe(0);
  });
});

describe('computeGradeAndVam', () => {
  it('computes grade% and vam from elevation gain over distance/time', () => {
    const block = [
      makeSecond({ secondIndex: 0, elevationM: 100 }),
      makeSecond({ secondIndex: 1, elevationM: 105 }),
    ];
    const summary = summarizeSegment(block, 'HILL');
    // distanceM comes from the synthetic block (0), so force a realistic one
    const result = computeGradeAndVam(block, {
      distanceM: 50,
      movingDurationSec: 60,
    });

    expect(result.avgGradePercent).toBe(10); // 5m / 50m * 100
    expect(result.vam).toBe(300); // 5m / 60s * 3600
    void summary;
  });

  it('returns 0 for both when distance/movingDurationSec are 0', () => {
    const block = [makeSecond({ secondIndex: 0 }), makeSecond({ secondIndex: 1 })];
    const result = computeGradeAndVam(block, { distanceM: 0, movingDurationSec: 0 });

    expect(result.avgGradePercent).toBe(0);
    expect(result.vam).toBe(0);
  });
});
