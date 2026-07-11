import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { LapType, Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { StravaClientService } from '../client/strava-client.service';
import { IntervalDetector } from './detectors/interval-detector';
import { HillDetector } from './detectors/hill-detector';
import { ProcessedDict } from './detectors/base-detector';
import {
  classifyIntervalLapsType,
  classifyHillLapsType,
} from './detectors/lap-classifier';
import { StreamProcessor } from './processors/streams-processor';

export interface ProcessedSecond {
  secondIndex: number;
  distanceTotalM: number;
  distanceDeltaM: number;
  speedRaw: number;
  speedMs: number;
  accelerationMs2: number;
  heartRate: number;
  elevationM: number;
  elevationSmooth: number;
  elevationDelta: number;
  gradePercent: number;
  verticalSpeedMs: number;
  paceSeckm: number | null;
}

type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

interface MappedLap {
  lapIndex: number;
  avgSpeed: number;
  avgPace: number;
  distanceM: number;
  totalDurationSec: number;
  movingDurationSec: number;
  startSec: number;
  endSec: number;
  avgHr: number;
  maxHr: number | null;
  elevGainM: number;
  avgGradePercent: number;
  vam: number;
  avgCadence: number | null;
}

export interface SyncProgress {
  state: 'idle' | 'running' | 'done' | 'error';
  phase: 'listing' | 'processing' | 'rate_limited' | null;
  total: number | null;
  processed: number;
  synced: number;
  errors: number;
  etaSeconds: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  message: string | null;
}

const ESTIMATED_SECONDS_PER_ACTIVITY = 9;

@Injectable()
export class StravaSyncService {
  private readonly logger = new Logger(StravaSyncService.name);
  private readonly prisma: PrismaClient;
  private isSyncing = false;

  private progress: SyncProgress = {
    state: 'idle',
    phase: null,
    total: null,
    processed: 0,
    synced: 0,
    errors: 0,
    etaSeconds: null,
    startedAt: null,
    finishedAt: null,
    message: null,
  };

  getProgress(): SyncProgress {
    const { total, processed, state, phase } = this.progress;
    const etaSeconds =
      state === 'running' && phase === 'processing' && total != null
        ? Math.max(total - processed, 0) * ESTIMATED_SECONDS_PER_ACTIVITY
        : null;
    return { ...this.progress, etaSeconds };
  }

  constructor(
    private readonly client: StravaClientService,
    private readonly config: ConfigService,
  ) {
    const adapter = new PrismaPg({
      connectionString: this.config.get<string>('DATABASE_URL'),
    });
    this.prisma = new PrismaClient({ adapter });
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async scheduledSync() {
    this.logger.log('Scheduled sync triggered');
    const userId = this.config.getOrThrow<string>('SEED_USER_ID');
    await this.sync(userId);
  }

  async sync(userId: string): Promise<{ synced: number; errors: number }> {
    if (this.isSyncing) {
      this.logger.warn('Sync already in progress, skipping');
      return { synced: 0, errors: 0 };
    }

    this.isSyncing = true;
    this.progress = {
      state: 'running',
      phase: 'listing',
      total: null,
      processed: 0,
      synced: 0,
      errors: 0,
      etaSeconds: null,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      message: null,
    };
    let synced = 0;
    let errors = 0;

    try {
      const after = await this.getLastActivityTimestamp(userId);
      const activities = await this.fetchAllActivities(userId, after);

      const runs = activities.filter((a: any) => a.type === 'Run');
      this.logger.log(`Found ${runs.length} new runs to process`);
      this.progress.total = runs.length;
      this.progress.phase = 'processing';

      for (const summary of runs) {
        try {
          await this.processActivity(userId, summary);
          synced++;
          this.progress.synced = synced;
          await this.sleep(9000);
        } catch (err: any) {
          if (err.message === 'STRAVA_RATE_LIMIT') {
            this.logger.warn('Rate limit hit, waiting 15 minutes...');
            this.progress.phase = 'rate_limited';
            await this.sleep(15 * 60 * 1000);
            this.progress.phase = 'processing';
          } else {
            this.logger.error(
              `Failed to process activity ${summary.id}: ${err.message}`,
            );
            errors++;
            this.progress.errors = errors;
          }
        }
        this.progress.processed++;
      }

      this.progress.state = 'done';
    } catch (err: any) {
      this.progress.state = 'error';
      this.progress.message = err.message ?? 'Unknown error';
      this.logger.error(`Sync failed: ${err.message}`);
    } finally {
      this.isSyncing = false;
      this.progress.phase = null;
      this.progress.finishedAt = new Date().toISOString();
    }

    this.logger.log(`Sync complete — ${synced} saved, ${errors} errors`);
    return { synced, errors };
  }

  private async processActivity(userId: string, summary: any): Promise<void> {
    const exists = await this.prisma.activity.findUnique({
      where: { stravaId: BigInt(summary.id) },
    });
    if (exists) return;

    const full = await this.client.get<any>(userId, `/activities/${summary.id}`);
    await this.sleep(300);

    const workoutType = classifyWorkoutType(full);
    const isStructured =
      workoutType === 'INTERVAL' || workoutType === 'HILL_REPEATS';

    await this.prisma.$transaction(async (tx) => {
      const activity = await tx.activity.create({
        data: {
          userId,
          stravaId:       BigInt(full.id),
          name:           full.name,
          type:           full.type,
          sportType:      full.sport_type ?? null,
          workoutType,
          startDate:      new Date(full.start_date),
          distanceKm:     full.distance ? full.distance / 1000 : null,
          movingTimeSec:  full.moving_time,
          paceRawSecKm:   full.moving_time && full.distance
            ? full.moving_time / (full.distance / 1000)
            : null,
          elevationGainM: full.total_elevation_gain ?? null,
          averageBpm:     full.average_heartrate ?? null,
          maxBpm:         full.max_heartrate ?? null,
          averageCadence: full.average_cadence != null ? full.average_cadence * 2 : null,
          summaryPolyline: full.map?.summary_polyline || null,
        },
      });

      if (isStructured) {
        await this.processStructuredActivity(tx, userId, activity.id, full, workoutType);
      } else {
        await this.processSteadyActivity(tx, userId, activity.id, full);
      }
    });

    this.logger.log(`Saved activity ${full.id} — ${full.name} [${workoutType}]`);
  }

  // easy and long runs laps collector
  private async processSteadyActivity(
    tx: TxClient,
    userId: string,
    activityId: string,
    fullData: any,
  ): Promise<void> {
    // if exists already recorded laps, use that (all STEADY)
    const savedRecorded = await this.saveRecordedLaps(
      tx,
      userId,
      activityId,
      fullData,
      (laps) => laps.map(() => LapType.STEADY),
    );
    if (savedRecorded) return;

    // only has one recorded lap - means that the activity was recorded directly using strava
    const laps: any[] = fullData.splits_metric ?? [];
    const lapType = LapType.STEADY
    if (laps.length > 0) {
      this.logger.debug(
        `Activity ${fullData.id}: No recorded laps. Using ${laps.length} metric splits as 1km laps.`,
      );
      
      const splitLaps = laps.map((lap: any) => {
        const distance = lap.distance ?? 0;
        const movingTime = lap.moving_time ?? 0;
        const elapsedTime = lap.elapsed_time ?? movingTime;
        
        const avgSpeed = lap.average_speed ?? (movingTime > 0 ? distance / movingTime : 0);
        
        //const elevGain = Math.max(lap.elevation_difference ?? 0, 0);
        const elevGain = lap.elevation_difference ?? 0;

        const avgHr = lap.average_heartrate ?? 0;

        return {
          activityId,
          lapType: LapType.STEADY,
          lapIndex: lap.split,
          startSec: 0,
          endSec: 0,
          distanceM: Math.round(distance * 10) / 10,
          totalDurationSec: elapsedTime,
          movingDurationSec: movingTime,
          avgPaceSecKm: avgSpeed > 0.3 ? 1000 / avgSpeed : 0,
          avgHr: Math.round(avgHr * 10) / 10,
          // splits_metric only carries average_heartrate, never a max
          maxHr: null,
          elevGainM: Math.round(elevGain * 10) / 10,
          avgGradePercent:
            distance > 0
              ? Math.round((elevGain / distance) * 100 * 10) / 10
              : 0,
          vam:
            movingTime > 0 && elevGain > 0
              ? Math.round((elevGain / movingTime) * 3600) 
              : 0,
        };
      });

      await tx.activityLap.createMany({
        data: splitLaps,
      });
    }
  }

  // interval and hill repeats laps collector
  private async processStructuredActivity(
    tx: TxClient,
    userId: string,
    activityId: string,
    fullData: any,
    workoutType: 'INTERVAL' | 'HILL_REPEATS',
  ): Promise<void> {
    // if exists already recorded laps, classify and use that
    const savedRecorded = await this.saveRecordedLaps(
      tx,
      userId,
      activityId,
      fullData,
      (laps) =>
        workoutType === 'INTERVAL'
          ? classifyIntervalLapsType(laps)
          : classifyHillLapsType(laps),
    );
    if (savedRecorded) return;

    // does not exist recorded laps - download streams
    this.logger.debug(
      `Activity ${fullData.id}: no recorded laps, running auto-detection`,
    );

    const rawStreams = await this.client.get<any>(
      userId,
      `/activities/${fullData.id}/streams`,
      {
        keys: 'time,distance,velocity_smooth,heartrate,altitude',
        key_by_type: 'true',
      },
    );

    await this.sleep(300);

    const timeStream  = rawStreams['time']?.data ?? [];
    const distStream  = rawStreams['distance']?.data ?? [];
    const speedStream = rawStreams['velocity_smooth']?.data ?? [];
    const hrStream    = rawStreams['heartrate']?.data ?? [];
    const altStream   = rawStreams['altitude']?.data ?? [];

    const secondsData: any[] = [];
    let prevDistance: number | null = null;

    for (let i = 0; i < timeStream.length; i++) {
      const totalDist = distStream[i] ?? 0;

      const delta =
        prevDistance == null
          ? 0
          : Math.max(totalDist - prevDistance, 0);

      prevDistance = totalDist;

      const speed = speedStream[i] ?? null;

      secondsData.push({
        activityId,
        secondIndex: timeStream[i],
        distanceTotalM: totalDist,
        distanceDeltaM: delta,
        speedMS: speed,
        heartRate: hrStream[i] ?? null,
        elevationM: altStream[i] ?? null,
        paceSecKm: speed && speed > 0 ? 1000 / speed : null,
      });
    }

    await tx.activitySecond.createMany({
      data: secondsData,
    });

    const processed = await this.processStreamsSQL(tx, activityId);

    const processedDict: ProcessedDict = new Map(
      processed.map((s) => [s.secondIndex, s]),
    );

    const detector =
      workoutType === 'INTERVAL'
        ? new IntervalDetector()
        : new HillDetector();

    const detectedLaps = detector.analyze(processedDict);

    let lapCreateData: any[];

    if (!detectedLaps.length) {
      this.logger.warn(
        `Activity ${fullData.id}: detector found no laps, falling back to splits`,
      );

      lapCreateData = this.buildSplitFallback(
        activityId,
        fullData,
      );
    } else {
      lapCreateData = detectedLaps.map((lap, idx) => ({
        activityId,
        lapType: lap.type,
        lapIndex: lap.lapIndex ?? idx + 1,
        startSec: lap.startSec,
        endSec: lap.endSec,
        distanceM: lap.distanceM,
        totalDurationSec: lap.totalDurationSec,
        movingDurationSec: lap.movingDurationSec,
        avgPaceSecKm: lap.avgPace,
        avgHr: lap.avgHr,
        maxHr: lap.maxHr,
        elevGainM: lap.elevGainM,
        avgGradePercent: lap.avgGradePercent,
        vam: lap.vam,
      }));
    }

    if (lapCreateData.length > 0) {
      await tx.activityLap.createMany({
        data: lapCreateData,
      });
    }
  }


  // shared recorded-laps path: detects laps recorded on the watch, maps them
  // (fetching the altitude stream for net elevation) and persists them with
  // the lap types returned by `classify`. Returns false when the activity has
  // no recorded laps, so each processor can fall back to its own strategy
  private async saveRecordedLaps(
    tx: TxClient,
    userId: string,
    activityId: string,
    fullData: any,
    classify: (laps: MappedLap[]) => LapType[],
  ): Promise<boolean> {
    const rawLaps: any[] = fullData.laps ?? [];

    const hasRecordedLaps =
      rawLaps.length > 1 &&
      typeof rawLaps[0]?.name === 'string' &&
      rawLaps[0].name.startsWith('Lap');

    if (!hasRecordedLaps) return false;

    this.logger.debug(
      `Activity ${fullData.id}: ${rawLaps.length} recorded laps, classifying`,
    );

    const altStream = await this.fetchAltitudeStream(userId, fullData.id);

    const mappedLaps: MappedLap[] = rawLaps.map((lap: any, i: number) => {
      const avgSpeed = lap.average_speed ?? 0;
      const distance = lap.distance ?? 0;
      const duration = lap.moving_time ?? 0;
      const elevGain = this.lapElevationGain(altStream, lap);

      return {
        lapIndex: lap.lap_index ?? i + 1,
        avgSpeed,
        avgPace: avgSpeed > 0.3 ? 1000 / avgSpeed : 0,
        distanceM: Math.round(distance * 10) / 10,
        totalDurationSec: lap.elapsed_time ?? duration,
        movingDurationSec: duration,
        startSec: lap.start_index ?? 0,
        endSec: lap.end_index ?? 0,
        avgHr: Math.round((lap.average_heartrate ?? 0) * 10) / 10,
        maxHr: lap.max_heartrate ?? null,
        elevGainM: Math.round(elevGain * 10) / 10,
        avgGradePercent:
          distance > 0
            ? Math.round((elevGain / distance) * 100 * 10) / 10
            : 0,
        vam:
          duration > 0 && elevGain > 0
            ? Math.round((elevGain / duration) * 3600)
            : 0,
        avgCadence:
          lap.average_cadence != null ? lap.average_cadence * 2 : null,
      };
    });

    const types = classify(mappedLaps);

    const lapCreateData = mappedLaps.map((lap, i) => ({
      activityId,
      lapType: types[i],
      lapIndex: lap.lapIndex,
      startSec: lap.startSec,
      endSec: lap.endSec,
      distanceM: lap.distanceM,
      totalDurationSec: lap.totalDurationSec,
      movingDurationSec: lap.movingDurationSec,
      avgPaceSecKm: lap.avgPace,
      avgHr: lap.avgHr,
      maxHr: lap.maxHr,
      elevGainM: lap.elevGainM,
      avgGradePercent: lap.avgGradePercent,
      vam: lap.vam,
      avgCadence: lap.avgCadence,
    }));

    if (lapCreateData.length > 0) {
      await tx.activityLap.createMany({
        data: lapCreateData,
      });
    }

    return true;
  }

  private async fetchAltitudeStream(
    userId: string,
    stravaActivityId: number | string,
  ): Promise<number[]> {
    const rawStreams = await this.client.get<any>(
      userId,
      `/activities/${stravaActivityId}/streams`,
      { keys: 'altitude', key_by_type: 'true' },
    );
    await this.sleep(300);
    return rawStreams['altitude']?.data ?? [];
  }

  // net elevation change (can be negative on downhill laps), derived from the
  // altitude stream since Strava's recorded-lap objects only expose cumulative gain
  private lapElevationGain(altStream: number[], lap: any): number {
    const startAlt = altStream[lap.start_index ?? -1];
    const endAlt = altStream[lap.end_index ?? -1];
    return startAlt != null && endAlt != null ? endAlt - startAlt : 0;
  }

  private async processStreamsSQL(
    tx: TxClient,
    activityId: string,
  ): Promise<ProcessedSecond[]> {
    
    // search for rawdata that is in the db
    const rawData = await tx.activitySecond.findMany({
      where: { activityId },
      select: {
        secondIndex: true,
        distanceTotalM: true,
        distanceDeltaM: true,
        heartRate: true,
        elevationM: true,
      },
      orderBy: { secondIndex: 'asc' },
    });

    return StreamProcessor.processStreams(rawData);
  }

  private buildSplitFallback(activityId: string, fullData: any): any[] {
    const splits: any[] = fullData.splits_metric ?? [];
    return splits
      .filter((s: any) => (s.distance ?? 0) > 0)
      .map((s: any) => {
        const distM   = s.distance ?? 0;
        const moveSec = s.moving_time ?? 0;
        const avgSpeed = moveSec > 0 ? distM / moveSec : 0;
        const elevGain = s.elevation_difference ?? 0;
        return {
          activityId,
          lapType:           'RUN',
          lapIndex:          s.split,
          startSec:          0,
          endSec:            0,
          distanceM:         Math.round(distM * 10) / 10,
          totalDurationSec:  s.elapsed_time ?? moveSec,
          movingDurationSec: moveSec,
          avgPaceSecKm:      avgSpeed > 0.3 ? 1000 / avgSpeed : 0,
          avgHr:             s.average_heartrate ?? 0,
          maxHr:             null,
          elevGainM:         Math.round(elevGain * 10) / 10,
          avgGradePercent:
            distM > 0 ? Math.round((elevGain / distM) * 100 * 10) / 10 : 0,
          vam:
            moveSec > 0 && elevGain > 0
              ? Math.round((elevGain / moveSec) * 3600)
              : 0,
        };
      });
  }

  // one-off backfill for activities synced before summaryPolyline existed;
  // the athlete activity list already carries map.summary_polyline, so this
  // costs ~2 API calls total instead of one per activity
  async backfillPolylines(userId: string): Promise<{ updated: number }> {
    const summaries = await this.fetchAllActivities(userId);
    let updated = 0;

    for (const summary of summaries) {
      const polyline = summary.map?.summary_polyline;
      if (!polyline) continue;

      const result = await this.prisma.activity.updateMany({
        where: { stravaId: BigInt(summary.id), summaryPolyline: null },
        data: { summaryPolyline: polyline },
      });
      updated += result.count;
    }

    this.logger.log(`Polyline backfill complete — ${updated} activities updated`);
    return { updated };
  }

  // one-off backfill for laps synced before maxHr existed. Detected laps are
  // recomputed from the per-second stream already stored in the DB (no API
  // cost); natively recorded laps need one full-activity fetch each; laps
  // built from metric splits stay null (Strava has no max HR per split)
  async backfillLapMaxHr(
    userId: string,
  ): Promise<{ fromSeconds: number; fetched: number; toFetch: number }> {
    if (this.isSyncing) {
      this.logger.warn('Sync in progress, skipping maxHr backfill');
      return { fromSeconds: 0, fetched: 0, toFetch: 0 };
    }
    this.isSyncing = true;

    try {
      const fromSeconds = await this.prisma.$executeRaw`
        UPDATE activity_laps l
        SET max_hr = sub.max_hr
        FROM (
          SELECT l2.id, MAX(s.heart_rate)::float AS max_hr
          FROM activity_laps l2
          JOIN activity_seconds s
            ON s."activityId" = l2."activityId"
           AND s.second_index BETWEEN l2.start_sec AND l2.end_sec
          WHERE l2.max_hr IS NULL
          GROUP BY l2.id
        ) sub
        WHERE l.id = sub.id
      `;

      const recorded = await this.prisma.activity.findMany({
        where: {
          userId,
          seconds: { none: {} },
          laps: { some: { maxHr: null, endSec: { gt: 0 } } },
        },
        select: { id: true, stravaId: true },
        orderBy: { startDate: 'asc' },
      });

      this.logger.log(
        `maxHr backfill: ${fromSeconds} laps updated from stored streams, ` +
          `fetching ${recorded.length} activities with recorded laps from Strava`,
      );

      let fetched = 0;
      for (let i = 0; i < recorded.length; ) {
        const activity = recorded[i];
        try {
          const full = await this.client.get<any>(
            userId,
            `/activities/${activity.stravaId}`,
          );
          await this.sleep(1000);

          for (const lap of full.laps ?? []) {
            if (lap.max_heartrate == null) continue;
            await this.prisma.activityLap.updateMany({
              where: {
                activityId: activity.id,
                lapIndex: lap.lap_index,
                maxHr: null,
              },
              data: { maxHr: lap.max_heartrate },
            });
          }

          fetched++;
          i++;
          if (fetched % 25 === 0) {
            this.logger.log(
              `maxHr backfill: ${fetched}/${recorded.length} activities fetched`,
            );
          }
        } catch (err: any) {
          if (err.message === 'STRAVA_RATE_LIMIT') {
            this.logger.warn(
              'Rate limit hit during maxHr backfill, waiting 15 minutes...',
            );
            await this.sleep(15 * 60 * 1000);
          } else {
            this.logger.error(
              `maxHr backfill failed for activity ${activity.stravaId}: ${err.message}`,
            );
            i++;
          }
        }
      }

      this.logger.log(
        `maxHr backfill complete — ${fromSeconds} laps from streams, ` +
          `${fetched}/${recorded.length} activities fetched from Strava`,
      );
      return { fromSeconds, fetched, toFetch: recorded.length };
    } finally {
      this.isSyncing = false;
    }
  }

  private async getLastActivityTimestamp(
    userId: string,
  ): Promise<number | undefined> {
    const last = await this.prisma.activity.findFirst({
      where:   { userId },
      orderBy: { startDate: 'desc' },
      select:  { startDate: true },
    });
    return last ? Math.floor(last.startDate.getTime() / 1000) : undefined;
  }

  private async fetchAllActivities(
    userId: string,
    after?: number,
  ): Promise<any[]> {
    const all: any[] = [];
    let page = 1;

    while (true) {
      const params: Record<string, string | number> = { per_page: 200, page };
      if (after) params.after = after;

      const batch = await this.client.get<any[]>(
        userId,
        '/athlete/activities',
        params,
      );
      if (!batch.length) break;

      all.push(...batch);
      page++;
    }

    return all;
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export function classifyWorkoutType(
    activity: any,
  ): 'EASY_OR_LONG' | 'INTERVAL' | 'HILL_REPEATS' {
    const description = (activity.description ?? '').toLowerCase();

    const hillKeywords = ['hill', 'subida', 'elevação'];
    if (hillKeywords.some((k) => description.includes(k))) return 'HILL_REPEATS';

    const intervalKeywords = ['tiro', 'interval', 'split'];
    if (intervalKeywords.some((k) => description.includes(k))) return 'INTERVAL';

    if (/\d+\s*[xX*]\s*\d+/.test(description)) return 'INTERVAL';
    if (/\d+\s*[xX]\s*\d+[:\']/.test(description)) return 'INTERVAL';

    return 'EASY_OR_LONG';
  }