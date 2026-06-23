import { Controller, Get, Query, Redirect, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StravaAuthService } from './strava-auth.service';

@Controller('strava/auth')
export class StravaAuthController {
  private readonly logger = new Logger(StravaAuthController.name);

  constructor(
    private readonly authService: StravaAuthService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @Redirect()
  authorize() {
    const url = this.authService.buildAuthUrl();
    this.logger.log(`Redirecting to Strava OAuth: ${url}`);
    return { url };
  }

  @Get('callback')
  async callback(@Query('code') code: string) {
    const userId = this.config.getOrThrow<string>('SEED_USER_ID');
    await this.authService.handleCallback(code, userId);
    return { message: 'Strava account connected successfully.' };
  }
}