import { Controller, Post, Logger, UseGuards } from '@nestjs/common';
import { BestEffortsSyncService } from './best-efforts-sync.service';
import { AuthGuard } from '../../auth/auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/current-user.decorator';

@Controller('strava/best-efforts')
@UseGuards(AuthGuard)
export class BestEffortsSyncController {
  private readonly logger = new Logger(BestEffortsSyncController.name);

  constructor(private readonly service: BestEffortsSyncService) {}

  @Post('backfill')
  backfill(@CurrentUser() user: AuthenticatedUser): { started: boolean } {
    this.logger.log('Best-efforts backfill triggered via HTTP');
    // fire-and-forget: one API call per pending activity, so this can run for
    // a long while — progress goes to the server log
    void this.service.backfillBestEfforts(user.id).catch((err) => {
      this.logger.error(`Best-efforts backfill failed: ${err.message}`);
    });
    return { started: true };
  }
}
