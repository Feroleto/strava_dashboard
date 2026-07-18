import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { SessionService } from 'src/auth/session.service';

const USER_ID = 'user_test_123';
const TOKEN_VERSION = 1;
const SECRET = 'test-secret';

function makeConfig(nodeEnv?: string) {
  return {
    get: vi.fn((key: string) => {
      if (key === 'NODE_ENV') return nodeEnv;
      return undefined;
    }),
  };
}

async function makeService(nodeEnv?: string): Promise<SessionService> {
  const module: TestingModule = await Test.createTestingModule({
    imports: [JwtModule.register({ secret: SECRET })],
    providers: [SessionService, { provide: ConfigService, useValue: makeConfig(nodeEnv) }],
  }).compile();

  return module.get(SessionService);
}

describe('SessionService', () => {
  let res: { cookie: ReturnType<typeof vi.fn>; clearCookie: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    res = { cookie: vi.fn(), clearCookie: vi.fn() };
  });

  describe('setCookie / extractSession round trip', () => {
    it('extracts the same userId and tokenVersion that were signed into the cookie', async () => {
      const service = await makeService('development');
      service.setCookie(res as any, USER_ID, TOKEN_VERSION);

      const [, token] = res.cookie.mock.calls[0];
      const req = { cookies: { session: token } };

      expect(service.extractSession(req as any)).toEqual({
        userId: USER_ID,
        tokenVersion: TOKEN_VERSION,
      });
    });
  });

  describe('extractSession', () => {
    it('returns null when there is no session cookie', async () => {
      const service = await makeService('development');
      expect(service.extractSession({ cookies: {} } as any)).toBeNull();
    });

    it('returns null for a garbage/tampered token', async () => {
      const service = await makeService('development');
      const req = { cookies: { session: 'not-a-real-jwt' } };
      expect(service.extractSession(req as any)).toBeNull();
    });

    it('returns tokenVersion undefined for a legacy token signed before the tv claim existed', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [JwtModule.register({ secret: SECRET })],
        providers: [
          SessionService,
          { provide: ConfigService, useValue: makeConfig('development') },
        ],
      }).compile();

      const service = module.get(SessionService);
      const jwt = module.get(JwtService);
      const legacyToken = jwt.sign({ sub: USER_ID });
      const req = { cookies: { session: legacyToken } };

      expect(service.extractSession(req as any)).toEqual({
        userId: USER_ID,
        tokenVersion: undefined,
      });
    });
  });

  describe('cookie flags by environment', () => {
    it('uses secure + sameSite=lax in production (Vercel proxies /api/* to Render, so it stays same-site)', async () => {
      const service = await makeService('production');
      service.setCookie(res as any, USER_ID, TOKEN_VERSION);

      const [, , options] = res.cookie.mock.calls[0];
      expect(options).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax' });
    });

    it('uses non-secure + sameSite=lax in dev (localhost, different ports but same site)', async () => {
      const service = await makeService('development');
      service.setCookie(res as any, USER_ID, TOKEN_VERSION);

      const [, , options] = res.cookie.mock.calls[0];
      expect(options).toMatchObject({ httpOnly: true, secure: false, sameSite: 'lax' });
    });
  });

  describe('clearCookie', () => {
    it('clears the session cookie with matching flags', async () => {
      const service = await makeService('production');
      service.clearCookie(res as any);

      expect(res.clearCookie).toHaveBeenCalledWith(
        'session',
        expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'lax' }),
      );
    });
  });
});
