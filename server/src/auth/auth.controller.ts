import { Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import type { MeResponse } from './auth.service';
import { SessionService } from './session.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly session: SessionService,
  ) {}

  // No AuthGuard here on purpose: "who am I" from an anonymous visitor is a
  // valid question, not an auth failure — answering 401 makes the browser log
  // a console error on every logged-out page load (flagged by Lighthouse)
  @Get('me')
  async me(@Req() req: Request): Promise<MeResponse | null> {
    return this.authService.authenticate(this.session.extractSession(req));
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const session = this.session.extractSession(req);
    try {
      if (session) await this.authService.invalidateSessions(session.userId);
    } finally {
      this.session.clearCookie(res);
    }
  }
}
