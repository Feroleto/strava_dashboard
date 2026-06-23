import { Controller, Post, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StravaSyncService } from './strava-sync.service';

@Controller('strava/sync')
export class StravaSyncController {
  private readonly logger = new Logger(StravaSyncController.name);

  constructor(
    private readonly syncService: StravaSyncService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  async triggerSync() {
    this.logger.log('Manual sync triggered via HTTP');
    const userId = this.config.getOrThrow<string>('SEED_USER_ID');
    const result = await this.syncService.sync(userId);
    return result;
  }
}