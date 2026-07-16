import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PersonalBestsService } from './personal-bests.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';

@Controller('personal-bests')
@UseGuards(AuthGuard)
export class PersonalBestsController {
  constructor(private readonly service: PersonalBestsService) {}

  @Get()
  async topRecords(@CurrentUser() user: AuthenticatedUser) {
    return this.service.topRecords(user.id);
  }

  // query param (not :name/history path param) because effort names like
  // "1/2 mile" contain a literal slash and would break path-segment routing
  @Get('history')
  async history(@CurrentUser() user: AuthenticatedUser, @Query('name') name?: string) {
    if (!name) {
      throw new BadRequestException('Missing required query param: name');
    }
    return this.service.history(user.id, name);
  }
}
