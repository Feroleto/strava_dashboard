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
    return {
      httpOnly: true,
      secure: this.isProd,
      sameSite: (this.isProd ? 'none' : 'lax') as 'none' | 'lax',
    };
  }

  setCookie(res: Response, userId: string): void {
    const token = this.jwt.sign({ sub: userId });
    res.cookie(COOKIE_NAME, token, {
      ...this.cookieOptions,
      maxAge: SESSION_MAX_AGE_MS,
    });
  }

  clearCookie(res: Response): void {
    res.clearCookie(COOKIE_NAME, this.cookieOptions);
  }

  extractUserId(req: Request): string | null {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return null;

    try {
      const payload = this.jwt.verify<{ sub: string }>(token);
      return payload.sub;
    } catch {
      return null;
    }
  }
}
