import { BadRequestException, Body, Controller, Get, Patch } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';

const MIN_MAX_HR = 100;
const MAX_MAX_HR = 230;

@Controller('users')
export class UsersController {
  constructor(
    private readonly service: UsersService,
    private readonly config: ConfigService,
  ) {}

  @Get('me')
  async me() {
    const userId = this.config.getOrThrow<string>('SEED_USER_ID');
    return this.service.getMe(userId);
  }

  @Patch('me')
  async update(@Body() body: { maxHr?: unknown }) {
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
    const userId = this.config.getOrThrow<string>('SEED_USER_ID');
    return this.service.updateMaxHr(userId, maxHr);
  }
}
