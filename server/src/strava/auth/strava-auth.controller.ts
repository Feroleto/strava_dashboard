import { Controller, Get, Query, Logger, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { StravaAccountConflictError, StravaAuthService } from './strava-auth.service';
import { SessionService } from '../../auth/session.service';
import { AuthService } from '../../auth/auth.service';

@Controller('strava/auth')
export class StravaAuthController {
  private readonly logger = new Logger(StravaAuthController.name);

  constructor(
    private readonly authService: StravaAuthService,
    private readonly session: SessionService,
    private readonly auth: AuthService,
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

    // the session cookie (sameSite:'lax') rides along on this top-level
    // redirect, so a logged-in user hitting the callback is a "connect"
    // flow; authenticate() (not extractSession alone) also checks
    // tokenVersion, so a stale/invalidated cookie correctly falls back to
    // the plain login flow below rather than being treated as connected
    const existingSession = this.session.extractSession(req);
    const currentUser = existingSession ? await this.auth.authenticate(existingSession) : null;

    try {
      const { userId, tokenVersion } = await this.authService.handleCallback(
        code,
        currentUser?.id ?? null,
      );
      this.session.setCookie(res, userId, tokenVersion);
      res.redirect(frontendUrl);
    } catch (err: any) {
      if (err instanceof StravaAccountConflictError) {
        this.logger.warn(`Strava connect rejected: ${err.message}`);
        res.redirect(`${frontendUrl}/?auth_error=strava_conflict`);
        return;
      }
      this.logger.error(`Strava OAuth callback failed: ${err.message}`);
      res.redirect(`${frontendUrl}/?auth_error=1`);
    }
  }
}
