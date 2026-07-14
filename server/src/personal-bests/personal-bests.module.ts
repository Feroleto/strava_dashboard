import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PersonalBestsController } from './personal-bests.controller';
import { PersonalBestsService } from './personal-bests.service';

@Module({
  imports: [ConfigModule],
  controllers: [PersonalBestsController],
  providers: [PersonalBestsService],
})
export class PersonalBestsModule {}
