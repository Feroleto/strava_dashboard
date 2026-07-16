import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { StravaModule } from './strava/strava.module';
import { ActivitiesModule } from './activities/activities.module';
import { GearModule } from './gear/gear.module';
import { PersonalBestsModule } from './personal-bests/personal-bests.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    StravaModule,
    ActivitiesModule,
    GearModule,
    PersonalBestsModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
