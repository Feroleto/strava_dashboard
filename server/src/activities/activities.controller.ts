import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WorkoutType } from '@prisma/client';
import { ActivitiesService } from './activities.service';
import { parsePagination } from './pagination';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';

@Controller('activities')
@UseGuards(AuthGuard)
export class ActivitiesController {
  constructor(private readonly service: ActivitiesService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('workoutType') workoutType?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const filters = this.parseFilters(workoutType, dateFrom, dateTo);
    const pagination = parsePagination(page, limit);

    return this.service.list(
      user.id,
      pagination.page,
      pagination.limit,
      filters.workoutType,
      filters.startDate,
      filters.endDate,
    );
  }

  @Get('weekly-distance')
  async weeklyDistance(
    @CurrentUser() user: AuthenticatedUser,
    @Query('workoutType') workoutType?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const filters = this.parseFilters(workoutType, dateFrom, dateTo);

    return this.service.weeklyDistance(
      user.id,
      filters.workoutType,
      filters.startDate,
      filters.endDate,
    );
  }

  @Get('laps')
  async laps(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listLapsForAnalysis(user.id);
  }

  @Get('hr-zones')
  async hrZones(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listHrZonesForAnalysis(user.id);
  }

  private parseFilters(workoutType?: string, dateFrom?: string, dateTo?: string) {
    if (workoutType && !Object.values(WorkoutType).includes(workoutType as WorkoutType)) {
      throw new BadRequestException(
        `Invalid workoutType. Expected one of: ${Object.values(WorkoutType).join(', ')}`,
      );
    }

    const startDate = this.parseDateParam('dateFrom', dateFrom);
    const endDate = this.parseDateParam('dateTo', dateTo);
    if (endDate) {
      endDate.setUTCHours(23, 59, 59, 999);
    }

    return {
      workoutType: workoutType as WorkoutType | undefined,
      startDate,
      endDate,
    };
  }

  private parseDateParam(name: string, value?: string): Date | undefined {
    if (!value) return undefined;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid ${name}. Expected a valid date (YYYY-MM-DD).`);
    }

    return date;
  }

  @Get(':id')
  async findById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const activity = await this.service.findById(user.id, id);

    if (!activity) {
      throw new NotFoundException(`Activity ${id} not found`);
    }

    return activity;
  }
}
