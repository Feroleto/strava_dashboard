import { Controller, Get, Query, Logger, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
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
  authorize(@Res() res: Response): void {
    // manual redirect instead of @Redirect(): the anti-CSRF state cookie has
    // to be set on this same response
    const state = this.session.setOauthState(res);
    const url = this.authService.buildAuthUrl(state);
    this.logger.log('Redirecting to Strava OAuth');
    res.redirect(url);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const frontendUrl = this.config.get<string>(
      'FRONTEND_URL',
      'http://localhost:5173',
    );

    const expectedState = this.session.consumeOauthState(req, res);
    if (!state || !expectedState || state !== expectedState) {
      this.logger.warn('Strava OAuth callback rejected: state mismatch');
      res.redirect(`${frontendUrl}/?auth_error=1`);
      return;
    }

    try {
      const { userId, tokenVersion } = await this.authService.handleCallback(code);
      this.session.setCookie(res, userId, tokenVersion);
      res.redirect(frontendUrl);
    } catch (err: any) {
      this.logger.error(`Strava OAuth callback failed: ${err.message}`);
      res.redirect(`${frontendUrl}/?auth_error=1`);
    }
  }
}
