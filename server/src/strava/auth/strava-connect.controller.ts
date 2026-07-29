import { Controller, Delete, Get, HttpCode, Logger, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { StravaAuthService } from './strava-auth.service';
import { SessionService } from '../../auth/session.service';
import { AuthGuard } from '../../auth/auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/current-user.decorator';

// separate from StravaAuthController (which is @Controller('strava/auth'))
// so the route base is strava/connect, not nested under strava/auth
@Controller('strava/connect')
@UseGuards(AuthGuard)
export class StravaConnectController {
  private readonly logger = new Logger(StravaConnectController.name);

  constructor(
    private readonly stravaAuth: StravaAuthService,
    private readonly session: SessionService,
  ) {}

  // near-identical to StravaAuthController.authorize — the small duplication
  // is accepted deliberately rather than extracting a shared helper for two
  // call sites; the callback (shared by both) disambiguates via session
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get()
  connect(@Res() res: Response): void {
    const state = this.session.setOauthState(res);
    const url = this.stravaAuth.buildAuthUrl(state);
    this.logger.log('Redirecting to Strava OAuth (connect flow)');
    res.redirect(url);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Delete()
  @HttpCode(204)
  async disconnect(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.stravaAuth.disconnectAccount(user.id);
  }
}
