import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { LapType, PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { StravaClientService } from '../client/strava-client.service';
import { IntervalDetector } from './detectors/interval-detector';
import { HillDetector } from './detectors/hill-detector';
import { ProcessedDict } from './detectors/base-detector';
import {
  classifyIntervalLapsType,
  classifyHillLapsType,
} from './detectors/lap-classifier';
import { classifyWorkoutType } from './detectors/workout-classifier';
import { StreamProcessor } from './processors/streams-processor';
import {
  buildLapsFromSplits,
  detectedLapToCreateData,
  mapRecordedLap,
  recordedLapToCreateData,
} from './processors/lap-mapper';
import { mapBestEfforts } from './processors/best-effort-mapper';
import { mapGearUpsert } from './processors/gear-mapper';
import {
  ActivityHrZoneTimeCreate,
  mapActivityHrZones,
} from './processors/hr-zone-mapper';
import { MappedLap } from './types';
import {
  StravaActivityDetail,
  StravaActivitySummary,
  StravaActivityZoneDistribution,
  StravaGear,
  StravaStreamSet,
} from './strava-api.types';

// placeholder used while building lap/second create-data before the
// activity row (and its generated id) exists — every use is overwritten
// with the real id once the activity is inserted inside the transaction
const PENDING_ACTIVITY_ID = '';

export interface SyncProgress {
  state: 'idle' | 'running' | 'done' | 'error';
  phase: 'listing' | 'processing' | 'rate_limited' | null;
  total: number | null;
  processed: number;
  synced: number;
  errors: number;
  etaSeconds: number | null;
  // start_date of the activity currently being processed — lets the frontend
  // show which year of the history the sync is working through
  processingDate: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  message: string | null;
}

interface SyncResult {
  synced: number;
  errors: number;
  rateLimited: boolean;
}

// typical Strava API calls per new activity: detail + HR zones + one
// streams fetch (altitude for recorded laps, or the full set for
// auto-detection) — used only to project the ETA against the rate budget
const REQUESTS_PER_ACTIVITY = 3;
const RATE_LIMIT_MESSAGE = 'Rate limited by Strava — will resume on the next scheduled sync';

function idleProgress(): SyncProgress {
  return {
    state: 'idle',
    phase: null,
    total: null,
    processed: 0,
    synced: 0,
    errors: 0,
    etaSeconds: null,
    processingDate: null,
    startedAt: null,
    finishedAt: null,
    message: null,
  };
}

@Injectable()
export class StravaSyncService {
  private readonly logger = new Logger(StravaSyncService.name);
  private readonly prisma: PrismaClient;
  // single global lock: the Strava rate limit is shared by the whole app, not
  // per account, so at most one sync (manual or the multi-account cron
  // batch) can hit the API at a time
  private isSyncing = false;

  // per-user progress, so GET /strava/sync/status can answer for the caller
  // without leaking other accounts' state; the cron batch writes into this
  // same map as it works through each account in turn
  private readonly progress = new Map<string, SyncProgress>();

  getProgress(userId: string): SyncProgress {
    const entry = this.progress.get(userId) ?? idleProgress();
    const { total, processed, state, phase } = entry;
    const etaSeconds =
      state === 'running' && phase === 'processing' && total != null
        ? this.client.estimateEtaSeconds(
            Math.max(total - processed, 0) * REQUESTS_PER_ACTIVITY,
          )
        : null;
    return { ...entry, etaSeconds };
  }

  private updateProgress(userId: string, patch: Partial<SyncProgress>): void {
    const current = this.progress.get(userId) ?? idleProgress();
    this.progress.set(userId, { ...current, ...patch });
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
    await this.syncAllAccounts();
  }

  // iterates every connected account sequentially, sharing the single rate
  // limit budget; aborts the whole batch (rather than moving on to the next
  // account) the moment any account reports rateLimited — the limit is
  // app-wide, so trying another account immediately would almost certainly
  // hit it again too. The next scheduled run 6h later is the natural retry.
  async syncAllAccounts(): Promise<void> {
    const accounts = await this.prisma.stravaAccount.findMany({
      select: { userId: true },
    });

    for (const { userId } of accounts) {
      const result = await this.sync(userId);
      if (result.rateLimited) {
        this.logger.warn(
          'Rate limited — aborting sync batch, remaining accounts will be picked up on the next scheduled run',
        );
        break;
      }
    }
  }

  async sync(userId: string): Promise<SyncResult> {
    if (this.isSyncing) {
      this.logger.warn('Sync already in progress, skipping');
      return { synced: 0, errors: 0, rateLimited: false };
    }

    this.isSyncing = true;
    this.progress.set(userId, {
      ...idleProgress(),
      state: 'running',
      phase: 'listing',
      startedAt: new Date().toISOString(),
    });
    let synced = 0;
    let errors = 0;
    let processed = 0;
    let rateLimited = false;

    try {
      const after = await this.getLastActivityTimestamp(userId);
      const activities = await this.fetchAllActivities(userId, after);

      const runs = activities.filter((a) => a.type === 'Run');
      this.logger.log(`Found ${runs.length} new runs to process`);
      this.updateProgress(userId, { total: runs.length, phase: 'processing' });

      for (const summary of runs) {
        this.updateProgress(userId, {
          processingDate: summary.start_date ?? null,
        });
        try {
          // pacing against the rate limit lives in StravaClientService
          // (adaptive throttle on the usage headers) — no fixed sleep here
          await this.processActivity(userId, summary);
          synced++;
        } catch (err: any) {
          if (err.message === 'STRAVA_RATE_LIMIT') {
            // the rate limit is app-wide — sleeping and retrying here would
            // only delay the other accounts waiting their turn in the same
            // batch, so this account's run just stops here
            this.logger.warn(`Rate limit hit syncing user ${userId}, aborting this run`);
            rateLimited = true;
            break;
          }
          this.logger.error(`Failed to process activity ${summary.id}: ${err.message}`);
          errors++;
        }
        processed++;
        this.updateProgress(userId, { synced, errors, processed });
      }

      this.updateProgress(userId, {
        state: rateLimited ? 'error' : 'done',
        phase: rateLimited ? 'rate_limited' : null,
        message: rateLimited ? RATE_LIMIT_MESSAGE : null,
      });
    } catch (err: any) {
      rateLimited = err.message === 'STRAVA_RATE_LIMIT';
      this.logger.error(`Sync failed for user ${userId}: ${err.message}`);
      this.updateProgress(userId, {
        state: 'error',
        phase: rateLimited ? 'rate_limited' : null,
        message: rateLimited ? RATE_LIMIT_MESSAGE : (err.message ?? 'Unknown error'),
      });
    } finally {
      this.isSyncing = false;
      this.updateProgress(userId, { finishedAt: new Date().toISOString() });
    }

    this.logger.log(`Sync complete for user ${userId} — ${synced} saved, ${errors} errors`);
    return { synced, errors, rateLimited };
  }

  private async processActivity(
    userId: string,
    summary: StravaActivitySummary,
  ): Promise<void> {
    const exists = await this.prisma.activity.findUnique({
      where: { stravaId: BigInt(summary.id) },
    });
    if (exists) return;

    const full = await this.client.get<StravaActivityDetail>(
      userId,
      `/activities/${summary.id}`,
    );
    await this.sleep(300);

    const workoutType = classifyWorkoutType(full);
    const isStructured =
      workoutType === 'INTERVAL' || workoutType === 'HILL_REPEATS';

    const gearId = await this.ensureGear(userId, full.gear_id);
    const hrZones = await this.fetchActivityHrZones(userId, full.id);

    // every Strava API call for this activity happens above this line — the
    // transaction below only performs DB writes, so a slow response (e.g.
    // the full-activity streams fetch used for auto-detection on
    // watch-less INTERVAL/HILL activities) can't eat into the 5s
    // interactive transaction timeout and expire it mid-write
    const { lapCreateData, secondsData } = isStructured
      ? await this.prepareStructuredLaps(userId, full, workoutType)
      : await this.prepareSteadyLaps(userId, full);

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
          gearId,
          bestEffortsSyncedAt: new Date(),
          hrZonesSyncedAt: hrZones != null ? new Date() : null,
        },
      });

      const efforts = mapBestEfforts(activity.id, full.best_efforts);
      if (efforts.length > 0) {
        await tx.activityBestEffort.createMany({ data: efforts });
      }

      if (hrZones && hrZones.length > 0) {
        await tx.activityHrZoneTime.createMany({
          data: hrZones.map((z) => ({ activityId: activity.id, ...z })),
        });
      }

      // non-null (even if empty) only on the structured auto-detection path —
      // steady runs and recorded-lap activities never touch activitySecond
      if (secondsData != null) {
        await tx.activitySecond.createMany({
          data: secondsData.map((s) => ({ ...s, activityId: activity.id })),
        });
      }

      if (lapCreateData.length > 0) {
        await tx.activityLap.createMany({
          data: lapCreateData.map((l) => ({ ...l, activityId: activity.id })),
        });
      }
    });

    this.logger.log(`Saved activity ${full.id} — ${full.name} [${workoutType}]`);
  }

  // resolves the gearId to store on the activity, upserting the Gear row
  // from Strava the first time a given gear_id is seen. Non-rate-limit
  // failures are swallowed so the activity still saves without a gear link —
  // a later sync will pick it up once the gear fetch succeeds
  private async ensureGear(
    userId: string,
    gearId: string | null | undefined,
  ): Promise<string | null> {
    if (!gearId) return null;

    const existing = await this.prisma.gear.findUnique({
      where: { id: gearId },
    });
    if (existing) return gearId;

    try {
      const raw = await this.client.get<StravaGear>(userId, `/gear/${gearId}`);
      await this.sleep(300);

      const data = mapGearUpsert(userId, raw);
      await this.prisma.gear.upsert({
        where: { id: gearId },
        create: data,
        update: data,
      });
      return gearId;
    } catch (err: any) {
      if (err.message === 'STRAVA_RATE_LIMIT') throw err;
      this.logger.warn(`Failed to fetch gear ${gearId}: ${err.message}`);
      return null;
    }
  }

  // fetches per-activity HR zone time distribution (premium-only Strava
  // feature). Non-rate-limit failures are swallowed and return null so the
  // activity still saves without hrZonesSyncedAt set — a later backfill
  // pass will retry it. A successful fetch that returns no data (no
  // premium, no HR monitor) resolves to [], which IS marked as synced so it
  // isn't retried forever — same contract as ensureGear, but degrading to
  // "no data" instead of "no link" since there's no cached-entity shortcut
  // to check first
  private async fetchActivityHrZones(
    userId: string,
    stravaActivityId: number,
  ): Promise<ActivityHrZoneTimeCreate[] | null> {
    try {
      const raw = await this.client.get<StravaActivityZoneDistribution[]>(
        userId,
        `/activities/${stravaActivityId}/zones`,
      );
      await this.sleep(300);
      return mapActivityHrZones(raw);
    } catch (err: any) {
      if (err.message === 'STRAVA_RATE_LIMIT') throw err;
      this.logger.warn(
        `Failed to fetch HR zones for activity ${stravaActivityId}: ${err.message}`,
      );
      return null;
    }
  }

  // easy and long runs laps collector — all network calls happen here,
  // before the DB transaction opens (see comment in processActivity)
  private async prepareSteadyLaps(
    userId: string,
    fullData: StravaActivityDetail,
  ): Promise<{
    lapCreateData: Prisma.ActivityLapCreateManyInput[];
    secondsData: Omit<Prisma.ActivitySecondCreateManyInput, 'activityId'>[] | null;
  }> {
    // if exists already recorded laps, use that (all STEADY)
    const recorded = await this.prepareRecordedLaps(
      userId,
      fullData,
      (laps) => laps.map(() => LapType.STEADY),
    );
    if (recorded) return { lapCreateData: recorded, secondsData: null };

    // only has one recorded lap - means that the activity was recorded directly using strava
    const splits = fullData.splits_metric ?? [];
    if (!splits.length) return { lapCreateData: [], secondsData: null };

    this.logger.debug(
      `Activity ${fullData.id}: No recorded laps. Using ${splits.length} metric splits as 1km laps.`,
    );

    return {
      lapCreateData: buildLapsFromSplits(PENDING_ACTIVITY_ID, splits, LapType.STEADY),
      secondsData: null,
    };
  }

  // interval and hill repeats laps collector — all network calls happen
  // here, before the DB transaction opens (see comment in processActivity)
  private async prepareStructuredLaps(
    userId: string,
    fullData: StravaActivityDetail,
    workoutType: 'INTERVAL' | 'HILL_REPEATS',
  ): Promise<{
    lapCreateData: Prisma.ActivityLapCreateManyInput[];
    secondsData: Omit<Prisma.ActivitySecondCreateManyInput, 'activityId'>[] | null;
  }> {
    // if exists already recorded laps, classify and use that
    const recorded = await this.prepareRecordedLaps(
      userId,
      fullData,
      (laps) =>
        workoutType === 'INTERVAL'
          ? classifyIntervalLapsType(laps)
          : classifyHillLapsType(laps),
    );
    if (recorded) return { lapCreateData: recorded, secondsData: null };

    // does not exist recorded laps - download streams
    this.logger.debug(
      `Activity ${fullData.id}: no recorded laps, running auto-detection`,
    );

    const rawStreams = await this.client.get<StravaStreamSet>(
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

    const secondsData: Omit<Prisma.ActivitySecondCreateManyInput, 'activityId'>[] = [];
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
        secondIndex: timeStream[i],
        distanceTotalM: totalDist,
        distanceDeltaM: delta,
        speedMS: speed,
        heartRate: hrStream[i] ?? null,
        elevationM: altStream[i] ?? null,
        paceSecKm: speed && speed > 0 ? 1000 / speed : null,
      });
    }

    // pure TS computation over the in-memory stream — no DB round-trip needed
    const processed = StreamProcessor.processStreams(secondsData);

    const processedDict: ProcessedDict = new Map(
      processed.map((s) => [s.secondIndex, s]),
    );

    const detector =
      workoutType === 'INTERVAL'
        ? new IntervalDetector()
        : new HillDetector();

    const detectedLaps = detector.analyze(processedDict);

    let lapCreateData: Prisma.ActivityLapCreateManyInput[];

    if (!detectedLaps.length) {
      this.logger.warn(
        `Activity ${fullData.id}: detector found no laps, falling back to splits`,
      );

      lapCreateData = buildLapsFromSplits(
        PENDING_ACTIVITY_ID,
        fullData.splits_metric ?? [],
        LapType.RUN,
      );
    } else {
      lapCreateData = detectedLaps.map((lap, idx) =>
        detectedLapToCreateData(PENDING_ACTIVITY_ID, lap, idx),
      );
    }

    return { lapCreateData, secondsData };
  }

  // shared recorded-laps path: detects laps recorded on the watch, maps them
  // (fetching the altitude stream for net elevation) and returns them with
  // the lap types returned by `classify`. Returns null when the activity has
  // no recorded laps, so each preparer falls back to its own strategy.
  // No DB access — the activity doesn't exist yet, so `activityId` on the
  // returned rows is a placeholder filled in once the transaction creates it
  private async prepareRecordedLaps(
    userId: string,
    fullData: StravaActivityDetail,
    classify: (laps: MappedLap[]) => LapType[],
  ): Promise<Prisma.ActivityLapCreateManyInput[] | null> {
    const rawLaps = fullData.laps ?? [];

    const hasRecordedLaps =
      rawLaps.length > 1 &&
      typeof rawLaps[0]?.name === 'string' &&
      rawLaps[0].name.startsWith('Lap');

    if (!hasRecordedLaps) return null;

    this.logger.debug(
      `Activity ${fullData.id}: ${rawLaps.length} recorded laps, classifying`,
    );

    const altStream = await this.fetchAltitudeStream(userId, fullData.id);

    const mappedLaps = rawLaps.map((lap, i) =>
      mapRecordedLap(lap, i, altStream),
    );

    const types = classify(mappedLaps);

    return mappedLaps.map((lap, i) =>
      recordedLapToCreateData(PENDING_ACTIVITY_ID, types[i], lap),
    );
  }

  private async fetchAltitudeStream(
    userId: string,
    stravaActivityId: number | string,
  ): Promise<number[]> {
    const rawStreams = await this.client.get<StravaStreamSet>(
      userId,
      `/activities/${stravaActivityId}/streams`,
      { keys: 'altitude', key_by_type: 'true' },
    );
    await this.sleep(300);
    return rawStreams['altitude']?.data ?? [];
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

  // one-off backfill for gear links on activities synced before Gear existed.
  // gear_id already comes for free in the activity list, so this costs ~2 API
  // calls for the listing plus one per not-yet-seen gear — much cheaper than
  // a per-activity detail fetch
  async backfillGear(userId: string): Promise<{ updated: number }> {
    const summaries = await this.fetchAllActivities(userId);
    let updated = 0;

    for (const summary of summaries) {
      if (!summary.gear_id) continue;

      const gearId = await this.ensureGear(userId, summary.gear_id);
      if (!gearId) continue;

      const result = await this.prisma.activity.updateMany({
        where: { stravaId: BigInt(summary.id), gearId: null },
        data: { gearId },
      });
      updated += result.count;
    }

    this.logger.log(`Gear backfill complete — ${updated} activities updated`);
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
          const full = await this.client.get<StravaActivityDetail>(
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
  ): Promise<StravaActivitySummary[]> {
    const all: StravaActivitySummary[] = [];
    let page = 1;

    while (true) {
      const params: Record<string, string | number> = { per_page: 200, page };
      if (after) params.after = after;

      const batch = await this.client.get<StravaActivitySummary[]>(
        userId,
        '/athlete/activities',
        params,
      );
      if (!batch.length) break;

      all.push(...batch);
      page++;
    }

    // Strava lists newest-first when `after` is absent (initial import);
    // processing oldest-first makes max(startDate) in the DB work as a
    // resume cursor if the import dies mid-run
    const startMs = (a: StravaActivitySummary) =>
      a.start_date ? new Date(a.start_date).getTime() : 0;
    all.sort((a, b) => startMs(a) - startMs(b));

    return all;
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
