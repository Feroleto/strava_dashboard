import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ActivitiesModule } from '../activities/activities.module';
import { GearController } from './gear.controller';
import { GearService } from './gear.service';

@Module({
  imports: [ConfigModule, ActivitiesModule],
  controllers: [GearController],
  providers: [GearService],
})
export class GearModule {}
