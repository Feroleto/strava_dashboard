import { describe, it, expect } from 'vitest';
import { mapActivityHrZones } from 'src/strava/sync/processors/hr-zone-mapper';
import { StravaActivityZoneDistribution } from 'src/strava/sync/strava-api.types';

describe('mapActivityHrZones', () => {
  it('maps the heartrate distribution buckets to zone rows', () => {
    const raw: StravaActivityZoneDistribution[] = [
      {
        type: 'heartrate',
        distribution_buckets: [
          { min: 0, max: 115, time: 120 },
          { min: 115, max: 145, time: 900 },
          { min: 145, max: 165, time: 300 },
        ],
      },
    ];

    expect(mapActivityHrZones(raw)).toEqual([
      { zoneIndex: 0, min: 0, max: 115, timeSec: 120 },
      { zoneIndex: 1, min: 115, max: 145, timeSec: 900 },
      { zoneIndex: 2, min: 145, max: 165, timeSec: 300 },
    ]);
  });

  it('returns [] when there is no heartrate entry (e.g. only power zones)', () => {
    const raw: StravaActivityZoneDistribution[] = [
      { type: 'power', distribution_buckets: [{ min: 0, max: 200, time: 600 }] },
    ];

    expect(mapActivityHrZones(raw)).toEqual([]);
  });

  it('returns [] for an empty array (non-premium account)', () => {
    expect(mapActivityHrZones([])).toEqual([]);
  });
});
