import { describe, it, expect } from 'vitest';
import type { ActivityHrZonePoint, ActivityLapPoint } from '@/lib/types';
import { startOfBin } from '@/features/dashboard/bins';
import { computeWeekMetrics, z2UpperBpmFor } from './useTrainingMetrics';

function lap(overrides: Partial<ActivityLapPoint>): ActivityLapPoint {
  return {
    activityId: 'act-1',
    activityStartDate: '2026-03-02T08:00:00Z', // a Monday, well in the past
    lapIndex: 0,
    workoutType: 'EASY_OR_LONG',
    distanceM: 1000,
    movingDurationSec: 300,
    avgPaceSecKm: 300,
    avgHr: 140,
    ...overrides,
  };
}

function hrZone(overrides: Partial<ActivityHrZonePoint>): ActivityHrZonePoint {
  return {
    activityId: 'act-1',
    activityStartDate: '2026-03-02T08:00:00Z',
    zoneIndex: 1,
    min: 115,
    max: 145,
    timeSec: 600,
    ...overrides,
  };
}

function weekFor(
  laps: ActivityLapPoint[],
  z2UpperBpm: number,
  hrZones: ActivityHrZonePoint[] = [],
) {
  const weeks = computeWeekMetrics(laps, z2UpperBpm, hrZones);
  const start = startOfBin(new Date(laps[0].activityStartDate), 'week').getTime();
  const w = weeks.find((x) => x.start.getTime() === start);
  if (!w) throw new Error('week not found');
  return w;
}

function weekAt(weeks: ReturnType<typeof computeWeekMetrics>, isoDate: string) {
  const start = startOfBin(new Date(isoDate), 'week').getTime();
  const w = weeks.find((x) => x.start.getTime() === start);
  if (!w) throw new Error('week not found');
  return w;
}

describe('z2UpperBpmFor', () => {
  it('derives 70% of maxHr when configured', () => {
    expect(z2UpperBpmFor(190)).toBeCloseTo(133);
  });

  it('falls back to the 150bpm placeholder when maxHr is not set', () => {
    expect(z2UpperBpmFor(null)).toBe(150);
  });
});

describe('computeWeekMetrics — z2Km', () => {
  it('counts a lap toward z2Km when avgHr is below the configured threshold', () => {
    const laps = [lap({ avgHr: 130 })];
    const w = weekFor(laps, z2UpperBpmFor(190)); // threshold 133
    expect(w.z2Km).toBeCloseTo(1);
    expect(w.hrKm).toBeCloseTo(1);
  });

  it('excludes a lap from z2Km when avgHr is at/above the threshold', () => {
    const laps = [lap({ avgHr: 160 })];
    const w = weekFor(laps, z2UpperBpmFor(190)); // threshold 133
    expect(w.z2Km).toBe(0);
    expect(w.hrKm).toBeCloseTo(1); // still counts toward hrKm (real reading)
  });

  it('never treats the avgHr === 0 sentinel (no monitor) as a real Z2 reading', () => {
    const laps = [lap({ avgHr: 0 })];
    const w = weekFor(laps, 150);
    expect(w.z2Km).toBe(0);
    expect(w.hrKm).toBe(0);
  });

  it('uses the 150bpm fallback when maxHr is not configured', () => {
    const laps = [lap({ avgHr: 145 })];
    const withFallback = weekFor(laps, z2UpperBpmFor(null));
    expect(withFallback.z2Km).toBeCloseTo(1); // 145 < 150
  });
});

describe('computeWeekMetrics — ef', () => {
  it('computes EF as speed (m/min) per bpm over Z2 laps', () => {
    // 1000m in 300s => 200 m/min; avgHr 130 => EF = 200/130
    const laps = [lap({ distanceM: 1000, movingDurationSec: 300, avgHr: 130 })];
    const w = weekFor(laps, z2UpperBpmFor(190)); // threshold 133, this lap qualifies
    expect(w.ef).not.toBeNull();
    expect(w.ef as number).toBeCloseTo(200 / 130, 5);
  });

  it('is null when no lap this week has a real HR reading inside Z2', () => {
    const laps = [lap({ avgHr: 0 }), lap({ avgHr: 170 })]; // no monitor / above Z2
    const w = weekFor(laps, z2UpperBpmFor(190));
    expect(w.ef).toBeNull();
  });

  it('weights avgHr and pace by duration across multiple Z2 laps', () => {
    const laps = [
      lap({ distanceM: 1000, movingDurationSec: 300, avgHr: 120 }),
      lap({ distanceM: 1000, movingDurationSec: 300, avgHr: 130 }),
    ];
    const w = weekFor(laps, z2UpperBpmFor(190));
    // both laps qualify (threshold 133); equal duration => simple average HR 125
    // total distance 2000m in 600s => 200 m/min
    expect(w.ef as number).toBeCloseTo(200 / 125, 5);
  });
});

describe('computeWeekMetrics — z2TimeSec (real Strava zone data)', () => {
  it('is byte-identical to calling without hrZones at all (regression guard)', () => {
    const laps = [lap({ avgHr: 130 }), lap({ avgHr: 160, lapIndex: 1 })];
    const withDefault = computeWeekMetrics(laps, z2UpperBpmFor(190));
    const withExplicitEmpty = computeWeekMetrics(laps, z2UpperBpmFor(190), []);
    expect(withDefault).toEqual(withExplicitEmpty);
    const w = weekFor(laps, z2UpperBpmFor(190));
    expect(w.z2TimeSec).toBeNull();
  });

  it('sums zoneIndex 1 (Z2) time for an activity present in hrZones, independent of z2Km', () => {
    const laps = [lap({ avgHr: 160 })]; // above the estimated Z2 threshold — z2Km is 0
    const hrZones = [
      hrZone({ zoneIndex: 0, timeSec: 60 }),
      hrZone({ zoneIndex: 1, timeSec: 900 }),
      hrZone({ zoneIndex: 2, timeSec: 200 }),
    ];
    const w = weekFor(laps, z2UpperBpmFor(190), hrZones);
    expect(w.z2Km).toBe(0); // distance-based calc unaffected, lap is above threshold
    expect(w.z2TimeSec).toBe(900); // real data only sums zoneIndex 1
  });

  it('is null for a week whose laps have no matching hrZones entry', () => {
    const laps = [lap({ avgHr: 130 })]; // week of 2026-03-02
    // zone data exists, but for a different activity in a different week —
    // none of it should be attributed to the lap's week
    const hrZones = [
      hrZone({ activityId: 'act-2', activityStartDate: '2026-04-06T08:00:00Z' }),
    ];
    const w = weekFor(laps, z2UpperBpmFor(190), hrZones);
    expect(w.z2TimeSec).toBeNull();
  });

  it('attributes an activity’s zone time to its own activityStartDate, not the lap’s', () => {
    // lap for act-1 falls in the week of 2026-03-02; the real zone data for
    // that same activity carries a different activityStartDate (a data
    // inconsistency that shouldn't happen in practice, but the grouping must
    // key off the zone row's own date so a mismatch can't leak into the
    // wrong week either way)
    const laps = [lap({ activityId: 'act-1', activityStartDate: '2026-03-02T08:00:00Z' })];
    const hrZones = [
      hrZone({
        activityId: 'act-1',
        activityStartDate: '2026-03-09T08:00:00Z',
        zoneIndex: 1,
        timeSec: 700,
      }),
    ];

    const weeks = computeWeekMetrics(laps, z2UpperBpmFor(190), hrZones);
    const lapWeek = weekAt(weeks, '2026-03-02T08:00:00Z');
    const zoneWeek = weekAt(weeks, '2026-03-09T08:00:00Z');

    expect(lapWeek.z2TimeSec).toBeNull();
    expect(zoneWeek.z2TimeSec).toBe(700);
  });
});
