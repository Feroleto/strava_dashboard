import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';

const COOKIE_NAME = 'session';
// kept in sync with the JwtModule signOptions default (JWT_EXPIRES_IN) — cookie
// maxAge can't be derived from that string without pulling in a date-math lib
// for this one field, so both default to 30 days and must be changed together
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class SessionService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private get isProd(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  private get cookieOptions() {
    // sameSite:'lax' works in both envs because the browser never talks to
    // the API cross-site: in prod, Vercel's rewrite (client/vercel.json)
    // proxies /api/* to Render server-side, so from the browser's point of
    // view every request (including the OAuth callback) stays on the
    // frontend's own origin; in dev, localhost:5173/:3000 are different
    // ports but the same site already. This also sidesteps Safari's default
    // third-party-cookie blocking, which drops sameSite:'none' cookies set
    // by a genuinely different domain (onrender.com) regardless of the
    // SameSite attribute — confirmed broken on iOS Safari, fine on Chrome
    return {
      httpOnly: true,
      secure: this.isProd,
      sameSite: 'lax' as const,
    };
  }

  setCookie(res: Response, userId: string, tokenVersion: number): void {
    const token = this.jwt.sign({ sub: userId, tv: tokenVersion });
    res.cookie(COOKIE_NAME, token, {
      ...this.cookieOptions,
      maxAge: SESSION_MAX_AGE_MS,
    });
  }

  clearCookie(res: Response): void {
    res.clearCookie(COOKIE_NAME, this.cookieOptions);
  }

  extractSession(req: Request): { userId: string; tokenVersion: number } | null {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return null;

    try {
      const payload = this.jwt.verify<{ sub: string; tv: number }>(token);
      return { userId: payload.sub, tokenVersion: payload.tv };
    } catch {
      return null;
    }
  }
}
