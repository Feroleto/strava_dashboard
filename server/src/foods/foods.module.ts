import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { FoodsController } from './foods.controller';
import { FoodsService } from './foods.service';
import { OpenFoodFactsService } from './open-food-facts.service';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [FoodsController],
  providers: [FoodsService, OpenFoodFactsService],
  exports: [FoodsService],
})
export class FoodsModule {}
