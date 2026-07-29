import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StravaAuthController } from 'src/strava/auth/strava-auth.controller';
import { StravaAccountConflictError, StravaAuthService } from 'src/strava/auth/strava-auth.service';
import { SessionService } from 'src/auth/session.service';
import { AuthService } from 'src/auth/auth.service';

const FRONTEND_URL = 'http://localhost:5173';
const STATE = 'a'.repeat(64);
const USER_ID = 'user_1';

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
    extractSession: ReturnType<typeof vi.fn>;
  };
  let auth: { authenticate: ReturnType<typeof vi.fn> };
  let res: { redirect: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    authService = {
      buildAuthUrl: vi.fn().mockReturnValue('https://www.strava.com/oauth/authorize?state=' + STATE),
      handleCallback: vi.fn().mockResolvedValue({ userId: USER_ID, tokenVersion: 0 }),
    };
    session = {
      setOauthState: vi.fn().mockReturnValue(STATE),
      consumeOauthState: vi.fn().mockReturnValue(STATE),
      setCookie: vi.fn(),
      extractSession: vi.fn().mockReturnValue(null),
    };
    auth = { authenticate: vi.fn().mockResolvedValue(null) };
    res = { redirect: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StravaAuthController],
      providers: [
        { provide: StravaAuthService, useValue: authService },
        { provide: SessionService, useValue: session },
        { provide: AuthService, useValue: auth },
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

    it('completes the login when the state matches the cookie and there is no session', async () => {
      await controller.callback('the-code', STATE, req as any, res as any);

      expect(authService.handleCallback).toHaveBeenCalledWith('the-code', null);
      expect(session.setCookie).toHaveBeenCalledWith(res, USER_ID, 0);
      expect(res.redirect).toHaveBeenCalledWith(FRONTEND_URL);
    });

    it('passes the existing userId through as a connect flow when a valid session is present', async () => {
      session.extractSession.mockReturnValue({ userId: USER_ID, tokenVersion: 1 });
      auth.authenticate.mockResolvedValue({ id: USER_ID, hasStravaAccount: false });

      await controller.callback('the-code', STATE, req as any, res as any);

      expect(auth.authenticate).toHaveBeenCalledWith({ userId: USER_ID, tokenVersion: 1 });
      expect(authService.handleCallback).toHaveBeenCalledWith('the-code', USER_ID);
    });

    it('treats a stale/invalidated session cookie as anonymous, not as a connect flow', async () => {
      // extractSession succeeds (signature is valid) but authenticate()
      // rejects it (tokenVersion no longer matches, e.g. logged out
      // elsewhere) — this must NOT be treated as a logged-in connect flow
      session.extractSession.mockReturnValue({ userId: USER_ID, tokenVersion: 0 });
      auth.authenticate.mockResolvedValue(null);

      await controller.callback('the-code', STATE, req as any, res as any);

      expect(authService.handleCallback).toHaveBeenCalledWith('the-code', null);
    });

    it('redirects with a distinct error when the Strava account is linked to a different user', async () => {
      authService.handleCallback.mockRejectedValue(
        new StravaAccountConflictError('already linked'),
      );

      await controller.callback('the-code', STATE, req as any, res as any);

      expect(res.redirect).toHaveBeenCalledWith(`${FRONTEND_URL}/?auth_error=strava_conflict`);
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
