import { describe, it, expect, vi } from 'vitest';
import { UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from 'src/auth/auth.guard';

function makeContext(req: any): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  it('throws UnauthorizedException when the session cannot be resolved', () => {
    const session = { extractUserId: vi.fn(() => null) };
    const guard = new AuthGuard(session as any);
    const req: any = { cookies: {} };

    expect(() => guard.canActivate(makeContext(req))).toThrow(UnauthorizedException);
  });

  it('populates req.user and allows the request through on a valid session', () => {
    const session = { extractUserId: vi.fn(() => 'user_test_123') };
    const guard = new AuthGuard(session as any);
    const req: any = { cookies: { session: 'valid-token' } };

    expect(guard.canActivate(makeContext(req))).toBe(true);
    expect(req.user).toEqual({ id: 'user_test_123' });
  });
});
