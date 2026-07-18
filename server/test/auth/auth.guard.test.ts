import { describe, it, expect, vi } from 'vitest';
import { UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from 'src/auth/auth.guard';

function makeContext(req: any): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  it('throws UnauthorizedException when authentication fails', async () => {
    const session = { extractSession: vi.fn(() => null) };
    const authService = { authenticate: vi.fn().mockResolvedValue(null) };
    const guard = new AuthGuard(session as any, authService as any);
    const req: any = { cookies: {} };

    await expect(guard.canActivate(makeContext(req))).rejects.toThrow(UnauthorizedException);
  });

  it('populates req.user and allows the request through on a valid session', async () => {
    const session = {
      extractSession: vi.fn(() => ({ userId: 'user_test_123', tokenVersion: 0 })),
    };
    const authService = {
      authenticate: vi.fn().mockResolvedValue({ id: 'user_test_123' }),
    };
    const guard = new AuthGuard(session as any, authService as any);
    const req: any = { cookies: { session: 'valid-token' } };

    await expect(guard.canActivate(makeContext(req))).resolves.toBe(true);
    expect(req.user).toEqual({ id: 'user_test_123' });
    expect(authService.authenticate).toHaveBeenCalledWith({
      userId: 'user_test_123',
      tokenVersion: 0,
    });
  });
});
