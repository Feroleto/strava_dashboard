import type { Prisma } from '@prisma/client';
import { StravaActivityZoneDistribution } from '../strava-api.types';

export type ActivityHrZoneTimeCreate = Omit<
  Prisma.ActivityHrZoneTimeCreateManyInput,
  'activityId'
>;

// Strava returns one entry per zone type (heartrate, power, ...); only the
// heartrate bucket is relevant here. A missing heartrate entry and an empty
// bucket array both mean "no zone data" (e.g. non-premium account) — neither
// is an error, both map to []
export function mapActivityHrZones(
  raw: StravaActivityZoneDistribution[],
): ActivityHrZoneTimeCreate[] {
  const heartRate = raw.find((zone) => zone.type === 'heartrate');
  if (!heartRate) return [];

  return heartRate.distribution_buckets.map((bucket, index) => ({
    zoneIndex: index,
    min: bucket.min,
    max: bucket.max,
    timeSec: bucket.time,
  }));
}
