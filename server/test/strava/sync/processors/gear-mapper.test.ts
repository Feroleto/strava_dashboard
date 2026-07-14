import { describe, it, expect } from 'vitest';
import { mapGearUpsert } from 'src/strava/sync/processors/gear-mapper';
import { StravaGear } from 'src/strava/sync/strava-api.types';

describe('mapGearUpsert', () => {
  it('maps Strava fields to the Gear upsert data shape', () => {
    const raw: StravaGear = {
      id: 'g12345678',
      name: 'Pegasus 40',
      brand_name: 'Nike',
      model_name: 'Pegasus',
      distance: 452000,
      primary: true,
      retired: false,
    };

    expect(mapGearUpsert('user-1', raw)).toEqual({
      id: 'g12345678',
      userId: 'user-1',
      name: 'Pegasus 40',
      brandName: 'Nike',
      modelName: 'Pegasus',
      distance: 452000,
      primary: true,
      retired: false,
    });
  });

  it('defaults brandName/modelName to null when absent', () => {
    const raw: StravaGear = {
      id: 'g1',
      name: 'Mystery Shoe',
      distance: 0,
      primary: false,
      retired: false,
    };

    const mapped = mapGearUpsert('user-1', raw);
    expect(mapped.brandName).toBeNull();
    expect(mapped.modelName).toBeNull();
  });
});
