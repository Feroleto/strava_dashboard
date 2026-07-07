import { Controller, Get, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ActivitiesService } from './activities.service';

@Controller('activities')
export class ActivitiesController {
  constructor(
    private readonly service: ActivitiesService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = this.config.getOrThrow<string>('SEED_USER_ID');
    return this.service.list(
      userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }
}