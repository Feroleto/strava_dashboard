import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { FoodsModule } from '../foods/foods.module';
import { MealsModule } from '../meals/meals.module';
import { SavedMealsController } from './saved-meals.controller';
import { SavedMealsService } from './saved-meals.service';

@Module({
  imports: [ConfigModule, AuthModule, FoodsModule, MealsModule],
  controllers: [SavedMealsController],
  providers: [SavedMealsService],
})
export class SavedMealsModule {}
