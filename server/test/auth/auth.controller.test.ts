import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from 'src/auth/auth.controller';
import { AuthService } from 'src/auth/auth.service';
import { SessionService } from 'src/auth/session.service';

const USER_ID = 'user_test_123';

describe('AuthController', () => {
  let controller: AuthController;
  let session: { extractSession: ReturnType<typeof vi.fn>; clearCookie: ReturnType<typeof vi.fn> };
  let authService: {
    authenticate: ReturnType<typeof vi.fn>;
    invalidateSessions: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    session = {
      extractSession: vi.fn(),
      clearCookie: vi.fn(),
    };
    authService = {
      authenticate: vi.fn(),
      invalidateSessions: vi.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: SessionService, useValue: session },
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    controller = module.get(AuthController);
  });

  describe('me', () => {
    it('forwards the extracted session into authenticate and returns its result', async () => {
      const extractedSession = { userId: USER_ID, tokenVersion: 1 };
      session.extractSession.mockReturnValue(extractedSession);
      authService.authenticate.mockResolvedValue({ id: USER_ID });

      const req: any = { cookies: { session: 'valid-token' } };
      const result = await controller.me(req);

      expect(authService.authenticate).toHaveBeenCalledWith(extractedSession);
      expect(result).toEqual({ id: USER_ID });
    });

    it('returns null for a visitor with no session, without treating it as an error', async () => {
      session.extractSession.mockReturnValue(null);
      authService.authenticate.mockResolvedValue(null);

      const req: any = { cookies: {} };
      const result = await controller.me(req);

      expect(result).toBeNull();
    });
  });

  describe('logout', () => {
    it('invalidates the session and clears the cookie when a session cookie is present', async () => {
      session.extractSession.mockReturnValue({ userId: USER_ID, tokenVersion: 0 });
      const req: any = { cookies: { session: 'valid-token' } };
      const res: any = {};

      await controller.logout(req, res);

      expect(authService.invalidateSessions).toHaveBeenCalledWith(USER_ID);
      expect(session.clearCookie).toHaveBeenCalledWith(res);
    });

    it('skips invalidation but still clears the cookie when there is no session', async () => {
      session.extractSession.mockReturnValue(null);
      const req: any = { cookies: {} };
      const res: any = {};

      await controller.logout(req, res);

      expect(authService.invalidateSessions).not.toHaveBeenCalled();
      expect(session.clearCookie).toHaveBeenCalledWith(res);
    });

    it('still clears the cookie even when invalidateSessions rejects', async () => {
      session.extractSession.mockReturnValue({ userId: USER_ID, tokenVersion: 0 });
      authService.invalidateSessions.mockRejectedValue(new Error('db down'));
      const req: any = { cookies: { session: 'valid-token' } };
      const res: any = {};

      await expect(controller.logout(req, res)).rejects.toThrow('db down');
      expect(session.clearCookie).toHaveBeenCalledWith(res);
    });
  });
});
