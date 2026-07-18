import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StravaAuthController } from 'src/strava/auth/strava-auth.controller';
import { StravaAuthService } from 'src/strava/auth/strava-auth.service';
import { SessionService } from 'src/auth/session.service';

const FRONTEND_URL = 'http://localhost:5173';
const STATE = 'a'.repeat(64);

describe('StravaAuthController', () => {
  let controller: StravaAuthController;
  let authService: {
    buildAuthUrl: ReturnType<typeof vi.fn>;
    handleCallback: ReturnType<typeof vi.fn>;
  };
  let session: {
    setOauthState: ReturnType<typeof vi.fn>;
    consumeOauthState: ReturnType<typeof vi.fn>;
    setCookie: ReturnType<typeof vi.fn>;
  };
  let res: { redirect: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    authService = {
      buildAuthUrl: vi.fn().mockReturnValue('https://www.strava.com/oauth/authorize?state=' + STATE),
      handleCallback: vi.fn().mockResolvedValue({ userId: 'user_1', tokenVersion: 0 }),
    };
    session = {
      setOauthState: vi.fn().mockReturnValue(STATE),
      consumeOauthState: vi.fn().mockReturnValue(STATE),
      setCookie: vi.fn(),
    };
    res = { redirect: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StravaAuthController],
      providers: [
        { provide: StravaAuthService, useValue: authService },
        { provide: SessionService, useValue: session },
        {
          provide: ConfigService,
          useValue: { get: vi.fn().mockReturnValue(FRONTEND_URL) },
        },
      ],
    }).compile();

    controller = module.get(StravaAuthController);
  });

  describe('authorize', () => {
    it('sets the anti-CSRF state cookie and redirects to Strava with that same state', () => {
      controller.authorize(res as any);

      expect(session.setOauthState).toHaveBeenCalled();
      expect(authService.buildAuthUrl).toHaveBeenCalledWith(STATE);
      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('strava.com'));
    });
  });

  describe('callback', () => {
    const req = { cookies: {} };

    it('completes the login when the state matches the cookie', async () => {
      await controller.callback('the-code', STATE, req as any, res as any);

      expect(authService.handleCallback).toHaveBeenCalledWith('the-code');
      expect(session.setCookie).toHaveBeenCalledWith(res, 'user_1', 0);
      expect(res.redirect).toHaveBeenCalledWith(FRONTEND_URL);
    });

    it('rejects a callback whose state does not match the cookie (login CSRF)', async () => {
      await controller.callback('the-code', 'b'.repeat(64), req as any, res as any);

      expect(authService.handleCallback).not.toHaveBeenCalled();
      expect(session.setCookie).not.toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith(`${FRONTEND_URL}/?auth_error=1`);
    });

    it('rejects a callback with no state cookie (direct/forged callback URL)', async () => {
      session.consumeOauthState.mockReturnValue(null);

      await controller.callback('the-code', STATE, req as any, res as any);

      expect(authService.handleCallback).not.toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith(`${FRONTEND_URL}/?auth_error=1`);
    });

    it('rejects a callback with an empty state param', async () => {
      await controller.callback('the-code', '' as any, req as any, res as any);

      expect(authService.handleCallback).not.toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith(`${FRONTEND_URL}/?auth_error=1`);
    });

    it('still redirects with auth_error when the token exchange itself fails', async () => {
      authService.handleCallback.mockRejectedValue(new Error('exchange failed'));

      await controller.callback('the-code', STATE, req as any, res as any);

      expect(res.redirect).toHaveBeenCalledWith(`${FRONTEND_URL}/?auth_error=1`);
    });
  });
});
