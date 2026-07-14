import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PersonalBestsService } from './personal-bests.service';

@Controller('personal-bests')
export class PersonalBestsController {
  constructor(
    private readonly service: PersonalBestsService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  async topRecords() {
    const userId = this.config.getOrThrow<string>('SEED_USER_ID');
    return this.service.topRecords(userId);
  }

  // query param (not :name/history path param) because effort names like
  // "1/2 mile" contain a literal slash and would break path-segment routing
  @Get('history')
  async history(@Query('name') name?: string) {
    if (!name) {
      throw new BadRequestException('Missing required query param: name');
    }
    const userId = this.config.getOrThrow<string>('SEED_USER_ID');
    return this.service.history(userId, name);
  }
}
