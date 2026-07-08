import { BadRequestException, Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WorkoutType } from '@prisma/client';
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
    @Query('workoutType') workoutType?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const userId = this.config.getOrThrow<string>('SEED_USER_ID');

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

    return this.service.list(
      userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      workoutType as WorkoutType | undefined,
      startDate,
      endDate,
    );
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
  async findById(@Param('id') id: string) {
    const userId = this.config.getOrThrow<string>('SEED_USER_ID');
    const activity = await this.service.findById(userId, id);

    if (!activity) {
      throw new NotFoundException(`Activity ${id} not found`);
    }

    return activity;
  }
}