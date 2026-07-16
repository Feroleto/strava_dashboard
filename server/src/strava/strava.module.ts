import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
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
import { StravaWebhookService } from './webhook/strava-webhook.service';
import { StravaWebhookController } from './webhook/strava-webhook.controller';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    AuthModule,
  ],
  controllers: [
    StravaAuthController,
    StravaSyncController,
    BestEffortsSyncController,
    AthleteZonesSyncController,
    HrZonesBackfillController,
    StravaWebhookController,
  ],
  providers: [
    StravaClientService,
    StravaAuthService,
    StravaSyncService,
    BestEffortsSyncService,
    AthleteZonesSyncService,
    HrZonesBackfillService,
    StravaWebhookService,
  ],
  exports: [StravaClientService],
})
export class StravaModule {}