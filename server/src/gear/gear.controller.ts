import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ActivitiesService } from '../activities/activities.service';
import { GearService } from './gear.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';

@Controller('gear')
@UseGuards(AuthGuard)
export class GearController {
  constructor(
    private readonly gearService: GearService,
    private readonly activitiesService: ActivitiesService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    return this.gearService.list(user.id);
  }

  @Get(':id/activities')
  async activities(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.activitiesService.list(
      user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      undefined,
      undefined,
      undefined,
      id,
    );
  }
}
