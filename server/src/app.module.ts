import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { StravaModule } from './strava/strava.module';
import { ActivitiesModule } from './activities/activities.module';
import { GearModule } from './gear/gear.module';
import { PersonalBestsModule } from './personal-bests/personal-bests.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    StravaModule,
    ActivitiesModule,
    GearModule,
    PersonalBestsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
