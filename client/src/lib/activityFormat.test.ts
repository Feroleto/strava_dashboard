import { describe, it, expect } from 'vitest';
import type { ActivityLap } from '@/lib/types';
import { lapLabels } from './activityFormat';

const identity = (key: string) => key;

function lap(overrides: Partial<ActivityLap>): ActivityLap {
  return {
    id: 'lap-1',
    lapIndex: 0,
    lapType: 'STEADY',
    movingDurationSec: 300,
    distanceM: 1000,
    avgPaceSecKm: 300,
    avgHr: 130,
    maxHr: 150,
    elevGainM: 0,
    avgCadence: 170,
    ...overrides,
  };
}

describe('lapLabels', () => {
  it('labels regular ~1km STEADY laps as "Km N", last lap allowed to be a partial split', () => {
    const laps = [
      lap({ id: '1', distanceM: 1005 }),
      lap({ id: '2', distanceM: 998 }),
      lap({ id: '3', distanceM: 300 }), // partial final split
    ];
    expect(lapLabels(laps, identity)).toEqual([
      'lapType.steady 1',
      'lapType.steady 2',
      'lapType.steady 3',
    ]);
  });

  it('falls back to the generic lap label when STEADY laps are not km-aligned', () => {
    const laps = [
      lap({ id: '1', distanceM: 1500 }),
      lap({ id: '2', distanceM: 1500 }),
      lap({ id: '3', distanceM: 1000 }),
      lap({ id: '4', distanceM: 1000 }),
    ];
    expect(lapLabels(laps, identity)).toEqual([
      'lapType.run 1',
      'lapType.run 2',
      'lapType.run 3',
      'lapType.run 4',
    ]);
  });

  it('keeps the bare "Km" label for a single STEADY lap', () => {
    const laps = [lap({ id: '1', distanceM: 350 })];
    expect(lapLabels(laps, identity)).toEqual(['lapType.steady']);
  });

  it('leaves non-STEADY lap types unaffected', () => {
    const laps = [
      lap({ id: '1', lapType: 'WARMUP', distanceM: 800 }),
      lap({ id: '2', lapType: 'WORKOUT', distanceM: 400 }),
      lap({ id: '3', lapType: 'REST', distanceM: 200 }),
      lap({ id: '4', lapType: 'WORKOUT', distanceM: 400 }),
    ];
    expect(lapLabels(laps, identity)).toEqual([
      'lapType.warmup',
      'lapType.workout 1',
      'lapType.rest',
      'lapType.workout 2',
    ]);
  });
});
