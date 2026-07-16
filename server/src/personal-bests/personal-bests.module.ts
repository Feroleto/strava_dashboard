import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { PersonalBestsController } from './personal-bests.controller';
import { PersonalBestsService } from './personal-bests.service';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [PersonalBestsController],
  providers: [PersonalBestsService],
})
export class PersonalBestsModule {}
