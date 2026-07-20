import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LapType, PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ActivitiesService, ActivityDetail } from '../activities.service';
import {
  computeGradeAndVam,
  summarizeSegment,
} from '../../strava/sync/processors/lap-stats-calculator';
import { ProcessedSecond } from '../../strava/sync/types';
import { ActivityStreamsService, StreamUnavailableError } from './activity-streams.service';
import { LapEditInput } from './dto';

// Laps sourced from Strava's own metric splits (buildLapsFromSplits, used
// whenever an activity has no native watch laps) don't always sum exactly
// to the activity's true recorded distance — a small, real imprecision in
// the source data, not something the walk below introduces. Without some
// slack, an unedited activity of that kind could never be saved at all: the
// stored distances open pre-filled and already a few meters short. The last
// lap in the list absorbs a shortfall up to this many *seconds* of stream
// (kept in seconds, not meters, to stay consistent with the index-based
// walk) instead of leaving it as an unreachable gap. Large enough to
// comfortably cover the observed few-meters-per-split slop even on a long
// activity with many splits, small enough that a genuine mistake (a whole
// missing lap, worth minutes) still gets rejected.
const COVERAGE_TOLERANCE_SEC = 60;

@Injectable()
export class LapEditorService {
  private readonly prisma: PrismaClient;

  constructor(
    private readonly config: ConfigService,
    private readonly streams: ActivityStreamsService,
    private readonly activitiesService: ActivitiesService,
  ) {
    const adapter = new PrismaPg({
      connectionString: this.config.get<string>('DATABASE_URL'),
    });
    this.prisma = new PrismaClient({ adapter });
  }

  async saveLaps(
    userId: string,
    activityId: string,
    laps: LapEditInput[],
  ): Promise<ActivityDetail> {
    let stream;
    try {
      stream = await this.streams.getStream(userId, activityId);
    } catch (err) {
      if (err instanceof StreamUnavailableError) {
        throw new UnprocessableEntityException('STREAM_UNAVAILABLE');
      }
      throw err;
    }

    if (!stream) {
      throw new NotFoundException(`Activity ${activityId} not found`);
    }

    const resolvedLaps = this.resolveLaps(activityId, stream.points, laps);

    await this.prisma.$transaction([
      this.prisma.activityLap.deleteMany({ where: { activityId } }),
      this.prisma.activityLap.createMany({ data: resolvedLaps }),
    ]);

    const updated = await this.activitiesService.findById(userId, activityId);
    if (!updated) {
      throw new NotFoundException(`Activity ${activityId} not found`);
    }
    return updated;
  }

  // Sequential walk from second 0: each lap's boundaries are entirely
  // derived from its position in the list + its own size, never stored —
  // so an edit to lap N naturally reflows every lap after it, and deleting
  // a lap leaves whatever gap the coverage check below reports, with no
  // separate "existing vs new" handling needed.
  private resolveLaps(
    activityId: string,
    points: ProcessedSecond[],
    laps: LapEditInput[],
  ): Prisma.ActivityLapCreateManyInput[] {
    const resolved: Prisma.ActivityLapCreateManyInput[] = [];
    let cursorIdx = 0;
    // distance-mode laps target a *cumulative* distance from a fixed anchor
    // (reset whenever a time-mode lap gives us an exact index) instead of
    // "sizeValue meters from wherever the previous lap actually ended" —
    // see resolveDistanceEndIdx for why
    let anchorIdx = 0;
    let cumulativeDistM = 0;

    for (let i = 0; i < laps.length; i++) {
      if (cursorIdx > points.length - 1) {
        throw new BadRequestException(
          `Lap ${i + 1} starts after the activity's recorded data ends`,
        );
      }

      const input = laps[i];
      const startIdx = cursorIdx;
      let endIdx: number;

      if (input.sizeMode === 'time') {
        endIdx = Math.min(
          startIdx + Math.round(input.sizeValue) - 1,
          points.length - 1,
        );
        // exact index arithmetic, no drift — re-anchor here so the next
        // distance-mode lap (if any) starts accumulating from this point
        anchorIdx = Math.min(endIdx + 1, points.length - 1);
        cumulativeDistM = 0;
      } else {
        cumulativeDistM += input.sizeValue;
        endIdx = this.resolveDistanceEndIdx(
          points,
          startIdx,
          points[anchorIdx].distanceTotalM,
          cumulativeDistM,
        );
      }

      // last lap in the list: absorb a small leftover instead of leaving
      // it as a gap the user has no reasonable way to close by hand — see
      // COVERAGE_TOLERANCE_SEC
      if (i === laps.length - 1) {
        const residual = points.length - 1 - endIdx;
        if (residual > 0 && residual <= COVERAGE_TOLERANCE_SEC) {
          endIdx = points.length - 1;
        }
      }

      const block = points.slice(startIdx, endIdx + 1);

      const summary = summarizeSegment(block, input.lapType);
      const { avgGradePercent, vam } = computeGradeAndVam(block, summary);

      resolved.push({
        activityId,
        lapType: input.lapType as LapType,
        lapIndex: i + 1,
        startSec: summary.startSec,
        endSec: summary.endSec,
        totalDurationSec: summary.totalDurationSec,
        movingDurationSec: summary.movingDurationSec,
        distanceM: summary.distanceM,
        avgPaceSecKm: summary.avgPace,
        avgHr: summary.avgHr,
        maxHr: summary.maxHr,
        elevGainM: summary.elevGainM,
        avgGradePercent,
        vam,
        avgCadence: summary.avgCadence,
      });

      cursorIdx = endIdx + 1;
    }

    if (cursorIdx < points.length) {
      const coveredM =
        points[cursorIdx - 1].distanceTotalM - points[0].distanceTotalM;
      const totalM =
        points[points.length - 1].distanceTotalM - points[0].distanceTotalM;
      throw new BadRequestException(
        `Laps must cover the entire activity: ${Math.round(coveredM)}m of ${Math.round(totalM)}m covered`,
      );
    }

    return resolved;
  }

  // First point (from startIdx on) whose distance since `anchorDist` reaches
  // `targetM`, or the last point if the stream runs out first. Targeting an
  // absolute cumulative distance from a fixed anchor — instead of sizeValue
  // meters relative to wherever the previous lap actually ended — bounds
  // every lap's overshoot (the "first point >= target" search rarely lands
  // exactly on target) to its own single quantization step, instead of
  // letting consecutive distance-mode laps' overshoots compound; without
  // this, a chain of N distance-mode laps could accumulate several meters
  // of drift by the last one, which then reads short since it just absorbs
  // whatever's left.
  private resolveDistanceEndIdx(
    points: ProcessedSecond[],
    startIdx: number,
    anchorDist: number,
    targetM: number,
  ): number {
    for (let idx = startIdx; idx < points.length; idx++) {
      if (points[idx].distanceTotalM - anchorDist >= targetM) {
        return idx;
      }
    }
    // ran out of stream before reaching the requested distance — clamp to
    // the end, the coverage check in resolveLaps will report the shortfall
    return points.length - 1;
  }
}
