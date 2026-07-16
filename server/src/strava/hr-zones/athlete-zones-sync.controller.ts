import { Controller, Logger, Post, UseGuards } from '@nestjs/common';
import { AthleteZonesSyncService } from './athlete-zones-sync.service';
import { AuthGuard } from '../../auth/auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/current-user.decorator';

@Controller('strava/hr-zones')
@UseGuards(AuthGuard)
export class AthleteZonesSyncController {
  private readonly logger = new Logger(AthleteZonesSyncController.name);

  constructor(private readonly service: AthleteZonesSyncService) {}

  @Post('sync-athlete')
  async syncAthlete(@CurrentUser() user: AuthenticatedUser) {
    // single Strava API call — cheap enough to await and return synchronously,
    // unlike the per-activity backfills below
    try {
      return await this.service.syncAthleteZones(user.id);
    } catch (err: any) {
      this.logger.error(`Athlete zones sync failed: ${err.message}`);
      throw err;
    }
  }
}
