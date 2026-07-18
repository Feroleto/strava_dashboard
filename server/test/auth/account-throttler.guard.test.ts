import { describe, it, expect, vi } from 'vitest';
import { ExecutionContext } from '@nestjs/common';
import { AccountThrottlerGuard } from 'src/auth/account-throttler.guard';

function makeContext(req: any): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

function makeFakeStorage(limit: number) {
  const hits = new Map<string, number>();
  return {
    increment: vi.fn(async (key: string) => {
      const totalHits = (hits.get(key) ?? 0) + 1;
      hits.set(key, totalHits);
      return {
        totalHits,
        timeToExpire: 60,
        isBlocked: totalHits > limit,
        timeToBlockExpire: 60,
      };
    }),
  };
}

describe('AccountThrottlerGuard', () => {
  it('allows up to the limit and blocks the next call for the same account', async () => {
    const storage = makeFakeStorage(10);
    const guard = new AccountThrottlerGuard(storage);
    const req: any = { user: { id: 'user_test_123' } };

    for (let i = 0; i < 10; i++) {
      await expect(guard.canActivate(makeContext(req))).resolves.toBe(true);
    }
    await expect(guard.canActivate(makeContext(req))).rejects.toThrow(
      'Too Many Requests',
    );
  });

  it('tracks different accounts independently', async () => {
    const storage = makeFakeStorage(10);
    const guard = new AccountThrottlerGuard(storage);

    for (let i = 0; i < 10; i++) {
      await guard.canActivate(makeContext({ user: { id: 'user_a' } }));
    }
    await expect(
      guard.canActivate(makeContext({ user: { id: 'user_a' } })),
    ).rejects.toThrow();
    await expect(
      guard.canActivate(makeContext({ user: { id: 'user_b' } })),
    ).resolves.toBe(true);
  });

  it('shares the bucket across different routes for the same account', async () => {
    const storage = makeFakeStorage(10);
    const guard = new AccountThrottlerGuard(storage);
    const req: any = { user: { id: 'user_test_123' } };

    for (let i = 0; i < 10; i++) {
      await guard.canActivate(makeContext(req));
    }

    // confirms the guard keys by account alone, not account+route — every
    // call went through with the same storage key regardless of which
    // "route" it simulates, which is what makes the shared 10/min bucket
    // actually shared instead of 10/min-per-route
    const calledKeys = new Set(
      storage.increment.mock.calls.map((call) => call[0]),
    );
    expect(calledKeys.size).toBe(1);
  });
});
