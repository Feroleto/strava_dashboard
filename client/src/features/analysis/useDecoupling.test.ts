import { describe, it, expect } from 'vitest';
import type { ActivityLapPoint } from '@/lib/types';
import { computeDecoupling } from './useDecoupling';

function lap(overrides: Partial<ActivityLapPoint>): ActivityLapPoint {
  return {
    activityId: 'act-1',
    activityStartDate: '2026-03-02T08:00:00Z',
    lapIndex: 0,
    workoutType: 'EASY_OR_LONG',
    distanceM: 1000,
    movingDurationSec: 300, // 200 m/min
    avgPaceSecKm: 300,
    avgHr: 130,
    ...overrides,
  };
}

// 10 x 1km laps, 5min each (constant pace), HR rising linearly from 120 to 165
function steadyRunWithDrift(activityId: string): ActivityLapPoint[] {
  return Array.from({ length: 10 }, (_, i) =>
    lap({
      activityId,
      lapIndex: i,
      avgHr: 120 + i * 5, // 120,125,...,165
    }),
  );
}

describe('computeDecoupling', () => {
  it('reports positive drift when pace holds steady and HR rises through the run', () => {
    const laps = steadyRunWithDrift('act-drift');
    const points = computeDecoupling(laps);

    expect(points).toHaveLength(1);
    expect(points[0].activityId).toBe('act-drift');
    // first half avg hr (120..140) < second half avg hr (145..165) at same
    // pace => efficiency drops in the second half => positive decoupling
    expect(points[0].decouplingPct).toBeGreaterThan(0);
  });

  it('omits activities with no HR monitor at all', () => {
    const laps = steadyRunWithDrift('act-no-hr').map((l) => ({ ...l, avgHr: 0 }));
    const points = computeDecoupling(laps);
    expect(points).toHaveLength(0);
  });

  it('omits INTERVAL activities even if long enough', () => {
    const laps = steadyRunWithDrift('act-interval').map((l) => ({
      ...l,
      workoutType: 'INTERVAL',
    }));
    const points = computeDecoupling(laps);
    expect(points).toHaveLength(0);
  });

  it('omits steady runs shorter than 25 minutes', () => {
    // 3 laps x 5min = 15min total, well under the 25min floor
    const laps = Array.from({ length: 3 }, (_, i) =>
      lap({ activityId: 'act-short', lapIndex: i }),
    );
    const points = computeDecoupling(laps);
    expect(points).toHaveLength(0);
  });

  it('reports ~0% decoupling for a perfectly even effort', () => {
    const laps = Array.from({ length: 10 }, (_, i) =>
      lap({ activityId: 'act-even', lapIndex: i, avgHr: 140 }),
    );
    const points = computeDecoupling(laps);
    expect(points).toHaveLength(1);
    expect(points[0].decouplingPct).toBeCloseTo(0, 5);
  });
});
