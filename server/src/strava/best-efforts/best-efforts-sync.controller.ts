import { Controller, Post, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BestEffortsSyncService } from './best-efforts-sync.service';

@Controller('strava/best-efforts')
export class BestEffortsSyncController {
  private readonly logger = new Logger(BestEffortsSyncController.name);

  constructor(
    private readonly service: BestEffortsSyncService,
    private readonly config: ConfigService,
  ) {}

  @Post('backfill')
  backfill(): { started: boolean } {
    this.logger.log('Best-efforts backfill triggered via HTTP');
    const userId = this.config.getOrThrow<string>('SEED_USER_ID');
    // fire-and-forget: one API call per pending activity, so this can run for
    // a long while — progress goes to the server log
    void this.service.backfillBestEfforts(userId).catch((err) => {
      this.logger.error(`Best-efforts backfill failed: ${err.message}`);
    });
    return { started: true };
  }
}
