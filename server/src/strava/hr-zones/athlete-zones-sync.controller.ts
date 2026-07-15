import { Controller, Logger, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AthleteZonesSyncService } from './athlete-zones-sync.service';

@Controller('strava/hr-zones')
export class AthleteZonesSyncController {
  private readonly logger = new Logger(AthleteZonesSyncController.name);

  constructor(
    private readonly service: AthleteZonesSyncService,
    private readonly config: ConfigService,
  ) {}

  @Post('sync-athlete')
  async syncAthlete() {
    const userId = this.config.getOrThrow<string>('SEED_USER_ID');
    // single Strava API call — cheap enough to await and return synchronously,
    // unlike the per-activity backfills below
    try {
      return await this.service.syncAthleteZones(userId);
    } catch (err: any) {
      this.logger.error(`Athlete zones sync failed: ${err.message}`);
      throw err;
    }
  }
}
