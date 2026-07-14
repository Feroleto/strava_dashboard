import { Controller, Get, Param, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ActivitiesService } from '../activities/activities.service';
import { GearService } from './gear.service';

@Controller('gear')
export class GearController {
  constructor(
    private readonly gearService: GearService,
    private readonly activitiesService: ActivitiesService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  async list() {
    const userId = this.config.getOrThrow<string>('SEED_USER_ID');
    return this.gearService.list(userId);
  }

  @Get(':id/activities')
  async activities(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = this.config.getOrThrow<string>('SEED_USER_ID');
    return this.activitiesService.list(
      userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      undefined,
      undefined,
      undefined,
      id,
    );
  }
}
