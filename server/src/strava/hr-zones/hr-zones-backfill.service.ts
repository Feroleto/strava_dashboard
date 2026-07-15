import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { StravaClientService } from '../client/strava-client.service';
import { mapActivityHrZones } from '../sync/processors/hr-zone-mapper';
import { StravaActivityZoneDistribution } from '../sync/strava-api.types';

const BATCH_SIZE = 20;

// one-off backfill for activities synced before HR zone data existed. New
// activities get their zone distribution fetched during the normal sync
// (see StravaSyncService.fetchActivityHrZones) — this job only covers the
// historical backlog, and is deliberately kept separate from
// StravaSyncService so it can't destabilize the main sync flow (same
// rationale as BestEffortsSyncService)
@Injectable()
export class HrZonesBackfillService {
  private readonly logger = new Logger(HrZonesBackfillService.name);
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

  async backfillHrZones(
    userId: string,
  ): Promise<{ processed: number; toProcess: number }> {
    if (this.isSyncing) {
      this.logger.warn('HR zones backfill already in progress, skipping');
      return { processed: 0, toProcess: 0 };
    }
    this.isSyncing = true;

    try {
      const pending = await this.prisma.activity.findMany({
        where: { userId, hrZonesSyncedAt: null },
        select: { id: true, stravaId: true },
        orderBy: { startDate: 'asc' },
      });

      this.logger.log(
        `HR zones backfill: ${pending.length} activities to process`,
      );

      let processed = 0;
      for (let i = 0; i < pending.length; ) {
        const activity = pending[i];
        try {
          const raw = await this.client.get<StravaActivityZoneDistribution[]>(
            userId,
            `/activities/${activity.stravaId}/zones`,
          );
          await this.sleep(300);

          // empty result (non-premium account, or no HR monitor) is not an
          // error — mark synced with zero rows so it's never retried
          const zones = mapActivityHrZones(raw);
          await this.prisma.$transaction([
            ...(zones.length > 0
              ? [
                  this.prisma.activityHrZoneTime.createMany({
                    data: zones.map((z) => ({ activityId: activity.id, ...z })),
                  }),
                ]
              : []),
            this.prisma.activity.update({
              where: { id: activity.id },
              data: { hrZonesSyncedAt: new Date() },
            }),
          ]);

          processed++;
          i++;
          if (processed % BATCH_SIZE === 0) {
            this.logger.log(
              `HR zones backfill: ${processed}/${pending.length} activities processed`,
            );
          }
        } catch (err: any) {
          if (err.message === 'STRAVA_RATE_LIMIT') {
            this.logger.warn(
              'Rate limit hit during HR zones backfill, waiting 15 minutes...',
            );
            await this.sleep(15 * 60 * 1000);
          } else {
            this.logger.error(
              `HR zones backfill failed for activity ${activity.stravaId}: ${err.message}`,
            );
            i++;
          }
        }
      }

      this.logger.log(
        `HR zones backfill complete — ${processed}/${pending.length} activities processed`,
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
