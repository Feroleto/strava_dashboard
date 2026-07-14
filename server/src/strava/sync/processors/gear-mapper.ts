import { StravaGear } from '../strava-api.types';

export interface GearUpsertData {
  id: string;
  userId: string;
  name: string;
  brandName: string | null;
  modelName: string | null;
  distance: number;
  primary: boolean;
  retired: boolean;
}

// used as both `create` and `update` payload in Gear.upsert — id/userId are
// stable across re-syncs, so re-setting them on update is harmless
export function mapGearUpsert(userId: string, raw: StravaGear): GearUpsertData {
  return {
    id: raw.id,
    userId,
    name: raw.name,
    brandName: raw.brand_name ?? null,
    modelName: raw.model_name ?? null,
    distance: raw.distance,
    primary: raw.primary,
    retired: raw.retired,
  };
}
