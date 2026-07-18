import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { StravaSyncService } from './strava-sync.service';
import type { SyncProgress } from './strava-sync.service';
import { AuthGuard } from '../../auth/auth.guard';
import { AccountThrottlerGuard } from '../../auth/account-throttler.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/current-user.decorator';

@Controller('strava/sync')
@UseGuards(AuthGuard)
export class StravaSyncController {
  private readonly logger = new Logger(StravaSyncController.name);

  constructor(private readonly syncService: StravaSyncService) {}

  @UseGuards(AccountThrottlerGuard)
  @Post()
  triggerSync(@CurrentUser() user: AuthenticatedUser): SyncProgress {
    this.logger.log('Manual sync triggered via HTTP');
    // fire-and-forget: progress is exposed via GET /strava/sync/status. Only
    // syncs the caller's own account — batch sync across all accounts is
    // cron-only (syncAllAccounts)
    void this.syncService.sync(user.id).catch((err) => {
      this.logger.error(`Background sync failed: ${err.message}`);
    });
    return this.syncService.getProgress(user.id);
  }

  @UseGuards(AccountThrottlerGuard)
  @Post('activity/:stravaId')
  async syncActivity(
    @CurrentUser() user: AuthenticatedUser,
    @Param('stravaId') stravaId: string,
  ): Promise<{ saved: boolean; message: string }> {
    const id = Number(stravaId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('stravaId must be a positive integer');
    }
    this.logger.log(`Single-activity sync triggered via HTTP for ${id}`);
    // synchronous (not fire-and-forget): one activity is a handful of API
    // calls, and the caller wants to know whether the recovery worked
    return this.syncService.syncActivityById(user.id, id);
  }

  @Get('status')
  getStatus(@CurrentUser() user: AuthenticatedUser): SyncProgress {
    return this.syncService.getProgress(user.id);
  }

  @UseGuards(AccountThrottlerGuard)
  @Post('backfill-polylines')
  async backfillPolylines(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ updated: number }> {
    this.logger.log('Polyline backfill triggered via HTTP');
    return this.syncService.backfillPolylines(user.id);
  }

  @UseGuards(AccountThrottlerGuard)
  @Post('backfill-gear')
  async backfillGear(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ updated: number }> {
    this.logger.log('Gear backfill triggered via HTTP');
    return this.syncService.backfillGear(user.id);
  }

  @UseGuards(AccountThrottlerGuard)
  @Post('backfill-lap-max-hr')
  backfillLapMaxHr(@CurrentUser() user: AuthenticatedUser): {
    started: boolean;
  } {
    this.logger.log('Lap maxHr backfill triggered via HTTP');
    // fire-and-forget: one API call per activity with recorded laps, so this
    // can run for a long while — progress goes to the server log
    void this.syncService.backfillLapMaxHr(user.id).catch((err) => {
      this.logger.error(`Lap maxHr backfill failed: ${err.message}`);
    });
    return { started: true };
  }
}
