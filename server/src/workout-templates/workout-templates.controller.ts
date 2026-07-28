import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { WorkoutTemplatesService } from './workout-templates.service';
import {
  parseAddTemplateExerciseInput,
  parseCreateTemplateInput,
  parseUpdateTemplateExerciseInput,
  parseUpdateTemplateInput,
} from './dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { CurrentLang } from '../common/current-lang.decorator';
import type { Lang } from '../common/lang';

@Controller('workout-templates')
@UseGuards(AuthGuard)
export class WorkoutTemplatesController {
  constructor(private readonly service: WorkoutTemplatesService) {}

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentLang() lang: Lang,
    @Body() body: unknown,
  ) {
    const input = parseCreateTemplateInput(body);
    return this.service.create(user.id, input, lang);
  }

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser, @CurrentLang() lang: Lang) {
    return this.service.list(user.id, lang);
  }

  @Get(':id')
  async findById(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentLang() lang: Lang,
    @Param('id') id: string,
  ) {
    const template = await this.service.findById(user.id, id, lang);
    if (!template) {
      throw new NotFoundException(`Workout template ${id} not found`);
    }
    return template;
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentLang() lang: Lang,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = parseUpdateTemplateInput(body);
    return this.service.update(user.id, id, input, lang);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.service.remove(user.id, id);
    return { ok: true };
  }

  @Post(':id/exercises')
  async addExercise(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentLang() lang: Lang,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = parseAddTemplateExerciseInput(body);
    return this.service.addExercise(user.id, id, input, lang);
  }

  @Patch(':id/exercises/:templateExerciseId')
  async updateExercise(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentLang() lang: Lang,
    @Param('id') id: string,
    @Param('templateExerciseId') templateExerciseId: string,
    @Body() body: unknown,
  ) {
    const input = parseUpdateTemplateExerciseInput(body);
    return this.service.updateExercise(user.id, id, templateExerciseId, input, lang);
  }

  @Delete(':id/exercises/:templateExerciseId')
  async removeExercise(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentLang() lang: Lang,
    @Param('id') id: string,
    @Param('templateExerciseId') templateExerciseId: string,
  ) {
    return this.service.removeExercise(user.id, id, templateExerciseId, lang);
  }
}
