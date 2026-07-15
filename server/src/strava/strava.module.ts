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
import { AthleteZonesSyncService } from './hr-zones/athlete-zones-sync.service';
import { AthleteZonesSyncController } from './hr-zones/athlete-zones-sync.controller';
import { HrZonesBackfillService } from './hr-zones/hr-zones-backfill.service';
import { HrZonesBackfillController } from './hr-zones/hr-zones-backfill.controller';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [
    StravaAuthController,
    StravaSyncController,
    BestEffortsSyncController,
    AthleteZonesSyncController,
    HrZonesBackfillController,
  ],
  providers: [
    StravaClientService,
    StravaAuthService,
    StravaSyncService,
    BestEffortsSyncService,
    AthleteZonesSyncService,
    HrZonesBackfillService,
  ],
  exports: [StravaClientService],
})
export class StravaModule {}