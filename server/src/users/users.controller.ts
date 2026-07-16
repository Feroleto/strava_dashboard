import { BadRequestException, Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';

const MIN_MAX_HR = 100;
const MAX_MAX_HR = 230;

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getMe(user.id);
  }

  @Patch('me')
  async update(@CurrentUser() user: AuthenticatedUser, @Body() body: { maxHr?: unknown }) {
    const { maxHr } = body ?? {};
    if (
      typeof maxHr !== 'number' ||
      !Number.isInteger(maxHr) ||
      maxHr < MIN_MAX_HR ||
      maxHr > MAX_MAX_HR
    ) {
      throw new BadRequestException(
        `maxHr must be an integer between ${MIN_MAX_HR} and ${MAX_MAX_HR}`,
      );
    }
    return this.service.updateMaxHr(user.id, maxHr);
  }
}
