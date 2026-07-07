import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
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
  ) {
    const userId = this.config.getOrThrow<string>('SEED_USER_ID');

    if (workoutType && !Object.values(WorkoutType).includes(workoutType as WorkoutType)) {
      throw new BadRequestException(
        `Invalid workoutType. Expected one of: ${Object.values(WorkoutType).join(', ')}`,
      );
    }

    return this.service.list(
      userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      workoutType as WorkoutType | undefined,
    );
  }
}