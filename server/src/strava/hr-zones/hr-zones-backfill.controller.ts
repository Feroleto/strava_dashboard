import { Controller, Post, Logger, UseGuards } from '@nestjs/common';
import { HrZonesBackfillService } from './hr-zones-backfill.service';
import { AuthGuard } from '../../auth/auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/current-user.decorator';

@Controller('strava/hr-zones')
@UseGuards(AuthGuard)
export class HrZonesBackfillController {
  private readonly logger = new Logger(HrZonesBackfillController.name);

  constructor(private readonly service: HrZonesBackfillService) {}

  @Post('backfill')
  backfill(@CurrentUser() user: AuthenticatedUser): { started: boolean } {
    this.logger.log('HR zones backfill triggered via HTTP');
    // fire-and-forget: one API call per pending activity, so this can run for
    // a long while — progress goes to the server log
    void this.service.backfillHrZones(user.id).catch((err) => {
      this.logger.error(`HR zones backfill failed: ${err.message}`);
    });
    return { started: true };
  }
}
