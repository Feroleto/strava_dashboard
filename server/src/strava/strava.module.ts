import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { StravaClientService } from './client/strava-client.service';
import { StravaAuthService } from './auth/strava-auth.service';
import { StravaAuthController } from './auth/strava-auth.controller';
import { StravaSyncService } from './sync/strava-sync.service';
import { StravaSyncController } from './sync/strava-sync.controller';
import { BestEffortsSyncService } from './best-efforts/best-efforts-sync.service';
import { BestEffortsSyncController } from './best-efforts/best-efforts-sync.controller';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [
    StravaAuthController,
    StravaSyncController,
    BestEffortsSyncController,
  ],
  providers: [
    StravaClientService,
    StravaAuthService,
    StravaSyncService,
    BestEffortsSyncService,
  ],
  exports: [StravaClientService],
})
export class StravaModule {}