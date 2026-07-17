import { Controller, Get, Query, Redirect, Logger, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { StravaAuthService } from './strava-auth.service';
import { SessionService } from '../../auth/session.service';

@Controller('strava/auth')
export class StravaAuthController {
  private readonly logger = new Logger(StravaAuthController.name);

  constructor(
    private readonly authService: StravaAuthService,
    private readonly session: SessionService,
    private readonly config: ConfigService,
  ) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get()
  @Redirect()
  authorize() {
    const url = this.authService.buildAuthUrl();
    this.logger.log(`Redirecting to Strava OAuth: ${url}`);
    return { url };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Res() res: Response,
  ): Promise<void> {
    const frontendUrl = this.config.get<string>(
      'FRONTEND_URL',
      'http://localhost:5173',
    );

    try {
      const { userId } = await this.authService.handleCallback(code);
      this.session.setCookie(res, userId);
      res.redirect(frontendUrl);
    } catch (err: any) {
      this.logger.error(`Strava OAuth callback failed: ${err.message}`);
      res.redirect(`${frontendUrl}/?auth_error=1`);
    }
  }
}
