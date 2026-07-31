import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { FoodLogsController } from './food-logs.controller';
import { FoodLogsService } from './food-logs.service';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [FoodLogsController],
  providers: [FoodLogsService],
})
export class FoodLogsModule {}
