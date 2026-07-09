import { Controller, Get, Post, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StravaSyncService } from './strava-sync.service';
import type { SyncProgress } from './strava-sync.service';

@Controller('strava/sync')
export class StravaSyncController {
  private readonly logger = new Logger(StravaSyncController.name);

  constructor(
    private readonly syncService: StravaSyncService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  triggerSync(): SyncProgress {
    this.logger.log('Manual sync triggered via HTTP');
    const userId = this.config.getOrThrow<string>('SEED_USER_ID');
    // fire-and-forget: progress is exposed via GET /strava/sync/status
    void this.syncService.sync(userId).catch((err) => {
      this.logger.error(`Background sync failed: ${err.message}`);
    });
    return this.syncService.getProgress();
  }

  @Get('status')
  getStatus(): SyncProgress {
    return this.syncService.getProgress();
  }

  @Post('backfill-polylines')
  async backfillPolylines(): Promise<{ updated: number }> {
    this.logger.log('Polyline backfill triggered via HTTP');
    const userId = this.config.getOrThrow<string>('SEED_USER_ID');
    return this.syncService.backfillPolylines(userId);
  }
}
