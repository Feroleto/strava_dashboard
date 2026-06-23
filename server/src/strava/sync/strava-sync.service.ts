import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { StravaClientService } from '../client/strava-client.service';

@Injectable()
export class StravaSyncService {
  private readonly logger = new Logger(StravaSyncService.name);
  private readonly prisma: PrismaClient;
  private isSyncing = false;

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
    let synced = 0;
    let errors = 0;

    try {
      const after = await this.getLastActivityTimestamp(userId);
      const activities = await this.fetchAllActivities(userId, after);

      const runs = activities.filter((a: any) => a.type === 'Run');
      this.logger.log(`Found ${runs.length} new runs to process`);

      for (const summary of runs) {
        try {
          await this.processActivity(userId, summary);
          synced++;
          // Basic rate limit guard — Strava allows 100 req/15min
          await this.sleep(1000);
        } catch (err: any) {
          if (err.message === 'STRAVA_RATE_LIMIT') {
            this.logger.warn('Rate limit hit, waiting 15 minutes...');
            await this.sleep(15 * 60 * 1000);
          } else {
            this.logger.error(`Failed to process activity ${summary.id}: ${err.message}`);
            errors++;
          }
        }
      }
    } finally {
      this.isSyncing = false;
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

    const workoutType = this.classifyWorkoutType(full);

    await this.prisma.$transaction(async (tx) => {
      const activity = await tx.activity.create({
        data: {
          userId,
          stravaId: BigInt(full.id),
          name: full.name,
          type: full.type,
          sportType: full.sport_type ?? null,
          workoutType,
          startDate: new Date(full.start_date),
          distanceKm: full.distance ? full.distance / 1000 : null,
          movingTimeSec: full.moving_time,
          paceRawSecKm: full.moving_time && full.distance
            ? full.moving_time / (full.distance / 1000)
            : null,
          elevationGainM: full.total_elevation_gain ?? null,
          averageBpm: full.average_heartrate ?? null,
          maxBpm: full.max_heartrate ?? null,
          averageCadence: full.average_cadence ?? null,
        },
      });

      const splits: any[] = full.splits_metric ?? [];
      if (splits.length > 0) {
        await tx.activitySplit.createMany({
          data: splits.map((s: any) => {
            const distKm = s.distance / 1000;
            const paceMinKm = distKm > 0 ? s.moving_time / 60 / distKm : 0;
            return {
              activityId: activity.id,
              splitIndex: s.split,
              distanceKm: distKm,
              movingTimeSec: s.moving_time,
              paceMinKm,
            };
          }),
        });
      }

      // Streams + Laps — only for interval/hill workouts (mirrors Python pipeline logic)
      // TODO: implement in next iteration once split/lap detection is ported
    });

    this.logger.log(`Saved activity ${full.id} — ${full.name}`);
  }

  private async getLastActivityTimestamp(userId: string): Promise<number | undefined> {
    const last = await this.prisma.activity.findFirst({
      where: { userId },
      orderBy: { startDate: 'desc' },
      select: { startDate: true },
    });

    return last ? Math.floor(last.startDate.getTime() / 1000) : undefined;
  }

  private async fetchAllActivities(userId: string, after?: number): Promise<any[]> {
    const all: any[] = [];
    let page = 1;

    while (true) {
      const params: Record<string, string | number> = { per_page: 200, page };
      if (after) params.after = after;

      const batch = await this.client.get<any[]>(userId, '/athlete/activities', params);
      if (!batch.length) break;

      all.push(...batch);
      page++;
    }

    return all;
  }

  private classifyWorkoutType(activity: any): 'EASY_OR_LONG' | 'INTERVAL' | 'HILL_REPEATS' {
    const description = (activity.description ?? '').toLowerCase();

    const hillKeywords = ['hill', 'subida', 'elevação'];
    if (hillKeywords.some((k) => description.includes(k))) return 'HILL_REPEATS';

    const intervalKeywords = ['tiro', 'interval', 'split'];
    if (intervalKeywords.some((k) => description.includes(k))) return 'INTERVAL';

    if (/\d+\s*[xX*]\s*\d+/.test(description)) return 'INTERVAL';
    if (/\d+\s*[xX]\s*\d+[:\']/.test(description)) return 'INTERVAL';

    return 'EASY_OR_LONG';
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}