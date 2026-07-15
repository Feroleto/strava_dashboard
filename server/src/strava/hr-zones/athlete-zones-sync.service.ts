import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { StravaClientService } from '../client/strava-client.service';
import { StravaAthleteZones } from '../sync/strava-api.types';

// athlete HR zone boundaries change rarely, so this is a manual/on-demand
// sync (POST /strava/hr-zones/sync-athlete), not part of the 6h cron —
// re-fetching it every cron cycle would spend rate-limit budget on data that
// almost never moves
@Injectable()
export class AthleteZonesSyncService {
  private readonly logger = new Logger(AthleteZonesSyncService.name);
  private readonly prisma: PrismaClient;

  constructor(
    private readonly client: StravaClientService,
    private readonly config: ConfigService,
  ) {
    const adapter = new PrismaPg({
      connectionString: this.config.get<string>('DATABASE_URL'),
    });
    this.prisma = new PrismaClient({ adapter });
  }

  async syncAthleteZones(
    userId: string,
  ): Promise<{ zones: { min: number; max: number }[] | null }> {
    const raw = await this.client.get<StravaAthleteZones>(
      userId,
      '/athlete/zones',
    );
    const zones = raw.heart_rate?.zones ?? [];
    if (zones.length === 0) {
      this.logger.warn(
        `No heart rate zones returned for user ${userId} (missing profile:read_all scope or zones not configured on Strava)`,
      );
      return { zones: null };
    }

    await this.prisma.athleteHrZones.upsert({
      where: { userId },
      create: {
        userId,
        customZones: raw.heart_rate!.custom_zones,
        zones,
        syncedAt: new Date(),
      },
      update: {
        customZones: raw.heart_rate!.custom_zones,
        zones,
        syncedAt: new Date(),
      },
    });

    return { zones };
  }
}
