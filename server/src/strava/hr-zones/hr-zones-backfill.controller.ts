import { Controller, Post, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HrZonesBackfillService } from './hr-zones-backfill.service';

@Controller('strava/hr-zones')
export class HrZonesBackfillController {
  private readonly logger = new Logger(HrZonesBackfillController.name);

  constructor(
    private readonly service: HrZonesBackfillService,
    private readonly config: ConfigService,
  ) {}

  @Post('backfill')
  backfill(): { started: boolean } {
    this.logger.log('HR zones backfill triggered via HTTP');
    const userId = this.config.getOrThrow<string>('SEED_USER_ID');
    // fire-and-forget: one API call per pending activity, so this can run for
    // a long while — progress goes to the server log
    void this.service.backfillHrZones(userId).catch((err) => {
      this.logger.error(`HR zones backfill failed: ${err.message}`);
    });
    return { started: true };
  }
}
