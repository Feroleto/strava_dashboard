import type { Prisma } from '@prisma/client';
import { StravaBestEffort } from '../strava-api.types';

type ActivityBestEffortCreate = Prisma.ActivityBestEffortCreateManyInput;

export function mapBestEfforts(
  activityId: string,
  efforts: StravaBestEffort[] | undefined,
): ActivityBestEffortCreate[] {
  return (efforts ?? []).map((effort) => ({
    id: String(effort.id),
    activityId,
    name: effort.name,
    distance: effort.distance,
    movingTime: effort.moving_time,
    elapsedTime: effort.elapsed_time,
    startDate: new Date(effort.start_date),
    prRank: effort.pr_rank ?? null,
    startIndex: effort.start_index ?? null,
    endIndex: effort.end_index ?? null,
  }));
}
