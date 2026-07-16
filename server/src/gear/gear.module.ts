import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { ActivitiesModule } from '../activities/activities.module';
import { GearController } from './gear.controller';
import { GearService } from './gear.service';

@Module({
  imports: [ConfigModule, AuthModule, ActivitiesModule],
  controllers: [GearController],
  providers: [GearService],
})
export class GearModule {}
