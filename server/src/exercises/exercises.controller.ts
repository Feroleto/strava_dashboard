import { Body, Controller, Get, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ExercisesService } from './exercises.service';
import { parseCreateExerciseInput, parseExerciseFilters, parseExercisePagination } from './dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { CurrentLang } from '../common/current-lang.decorator';
import type { Lang } from '../common/lang';

@Controller('exercises')
@UseGuards(AuthGuard)
export class ExercisesController {
  constructor(private readonly service: ExercisesService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentLang() lang: Lang,
    @Query('search') search?: string,
    @Query('muscle') muscle?: string,
    @Query('equipment') equipment?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('muscles') muscles?: string,
  ) {
    const filters = parseExerciseFilters(search, muscle, equipment, muscles);
    const pagination = parseExercisePagination(page, limit);
    return this.service.list(user.id, pagination.page, pagination.limit, filters, lang);
  }

  @Get(':id/last-performance')
  async lastPerformance(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.lastPerformance(user.id, id);
  }

  @Get(':id/personal-record')
  async personalRecord(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.personalRecord(user.id, id);
  }

  @Get(':id')
  async findById(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentLang() lang: Lang,
    @Param('id') id: string,
  ) {
    const exercise = await this.service.findById(user.id, id, lang);
    if (!exercise) {
      throw new NotFoundException(`Exercise ${id} not found`);
    }
    return exercise;
  }

  @Post()
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const input = parseCreateExerciseInput(body);
    return this.service.create(user.id, input);
  }
}
