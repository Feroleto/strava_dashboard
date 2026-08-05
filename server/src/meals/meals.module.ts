import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { MealsController } from './meals.controller';
import { MealsService } from './meals.service';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [MealsController],
  // exported so FoodLogsService/SavedMealsService can call assertOwned instead
  // of each duplicating a meal.findFirst against its own PrismaClient
  providers: [MealsService],
  exports: [MealsService],
})
export class MealsModule {}
