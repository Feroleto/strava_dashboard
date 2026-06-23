import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { StravaClientService } from './client/strava-client.service';
import { StravaAuthService } from './auth/strava-auth.service';
import { StravaAuthController } from './auth/strava-auth.controller';
import { StravaSyncService } from './sync/strava-sync.service';
import { StravaSyncController } from './sync/strava-sync.controller';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [
    StravaAuthController,
    StravaSyncController,
  ],
  providers: [
    StravaClientService,
    StravaAuthService,
    StravaSyncService,
  ],
  exports: [StravaClientService],
})
export class StravaModule {}