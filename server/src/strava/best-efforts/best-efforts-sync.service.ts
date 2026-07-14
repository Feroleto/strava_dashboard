import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { StravaClientService } from '../client/strava-client.service';
import { mapBestEfforts } from '../sync/processors/best-effort-mapper';
import { StravaActivityDetail } from '../sync/strava-api.types';

const BATCH_SIZE = 20;

// one-off backfill for activities synced before best-efforts existed. New
// activities get their best efforts extracted for free during the normal
// sync (the detail response is already fetched there) — this job only
// covers the historical backlog, and is deliberately kept separate from
// StravaSyncService so it can't destabilize the main sync flow
@Injectable()
export class BestEffortsSyncService {
  private readonly logger = new Logger(BestEffortsSyncService.name);
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

  async backfillBestEfforts(
    userId: string,
  ): Promise<{ processed: number; toProcess: number }> {
    if (this.isSyncing) {
      this.logger.warn('Best-efforts backfill already in progress, skipping');
      return { processed: 0, toProcess: 0 };
    }
    this.isSyncing = true;

    try {
      const pending = await this.prisma.activity.findMany({
        where: { userId, bestEffortsSyncedAt: null },
        select: { id: true, stravaId: true },
        orderBy: { startDate: 'asc' },
      });

      this.logger.log(
        `Best-efforts backfill: ${pending.length} activities to process`,
      );

      let processed = 0;
      for (let i = 0; i < pending.length; ) {
        const activity = pending[i];
        try {
          const full = await this.client.get<StravaActivityDetail>(
            userId,
            `/activities/${activity.stravaId}`,
          );
          await this.sleep(300);

          const efforts = mapBestEfforts(activity.id, full.best_efforts);
          await this.prisma.$transaction([
            this.prisma.activityBestEffort.createMany({ data: efforts }),
            this.prisma.activity.update({
              where: { id: activity.id },
              data: { bestEffortsSyncedAt: new Date() },
            }),
          ]);

          processed++;
          i++;
          if (processed % BATCH_SIZE === 0) {
            this.logger.log(
              `Best-efforts backfill: ${processed}/${pending.length} activities processed`,
            );
          }
        } catch (err: any) {
          if (err.message === 'STRAVA_RATE_LIMIT') {
            this.logger.warn(
              'Rate limit hit during best-efforts backfill, waiting 15 minutes...',
            );
            await this.sleep(15 * 60 * 1000);
          } else {
            this.logger.error(
              `Best-efforts backfill failed for activity ${activity.stravaId}: ${err.message}`,
            );
            i++;
          }
        }
      }

      this.logger.log(
        `Best-efforts backfill complete — ${processed}/${pending.length} activities processed`,
      );
      return { processed, toProcess: pending.length };
    } finally {
      this.isSyncing = false;
    }
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
