import { describe, it, expect } from 'vitest';
import { mapBestEfforts } from 'src/strava/sync/processors/best-effort-mapper';
import { StravaBestEffort } from 'src/strava/sync/strava-api.types';

describe('mapBestEfforts', () => {
  it('maps Strava fields to the Prisma createMany shape', () => {
    const efforts: StravaBestEffort[] = [
      {
        id: 123456789,
        name: '5k',
        distance: 5000,
        moving_time: 1200,
        elapsed_time: 1205,
        start_date: '2026-05-01T10:00:00Z',
        pr_rank: 1,
        start_index: 10,
        end_index: 1210,
      },
    ];

    expect(mapBestEfforts('activity-1', efforts)).toEqual([
      {
        id: '123456789',
        activityId: 'activity-1',
        name: '5k',
        distance: 5000,
        movingTime: 1200,
        elapsedTime: 1205,
        startDate: new Date('2026-05-01T10:00:00Z'),
        prRank: 1,
        startIndex: 10,
        endIndex: 1210,
      },
    ]);
  });

  it('defaults prRank/startIndex/endIndex to null when absent', () => {
    const efforts: StravaBestEffort[] = [
      {
        id: 1,
        name: '400m',
        distance: 400,
        moving_time: 90,
        elapsed_time: 90,
        start_date: '2026-05-01T10:00:00Z',
      },
    ];

    const [mapped] = mapBestEfforts('activity-1', efforts);
    expect(mapped.prRank).toBeNull();
    expect(mapped.startIndex).toBeNull();
    expect(mapped.endIndex).toBeNull();
  });

  it('coerces the numeric Strava id to a string', () => {
    const [mapped] = mapBestEfforts('activity-1', [
      {
        id: 987654321,
        name: '1k',
        distance: 1000,
        moving_time: 200,
        elapsed_time: 200,
        start_date: '2026-05-01T10:00:00Z',
      },
    ]);
    expect(mapped.id).toBe('987654321');
    expect(typeof mapped.id).toBe('string');
  });

  it('returns an empty array when efforts is undefined', () => {
    expect(mapBestEfforts('activity-1', undefined)).toEqual([]);
  });
});
