import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { InjectThrottlerStorage, ThrottlerException } from '@nestjs/throttler';
import type { ThrottlerStorage } from '@nestjs/throttler';

const TTL_MS = 60_000;
const LIMIT = 10;
const THROTTLER_NAME = 'strava-account';

// Per-account rate limit for endpoints that call the Strava API. Strava's
// rate limit is app-wide, not per account (see CLAUDE.md), so a single
// account hammering these endpoints can exhaust the shared budget for
// everyone, regardless of IP — the existing IP-based ThrottlerGuard doesn't
// catch that. Deliberately not a second named throttler inside
// ThrottlerModule.forRoot()'s array: the global IP guard iterates every
// named throttler in that array, so a second name there would get applied
// by IP on every route too. Hand-rolled guard instead (same minimalist
// philosophy as AuthGuard), but reusing @nestjs/throttler's injectable
// ThrottlerStorage (available anywhere since ThrottlerModule is @Global())
// rather than a bespoke Map with its own expiry logic. Key is per account
// only, shared across every route this guard is applied to — never add a
// route component to the key, or a single account could do
// routes × LIMIT requests/min, defeating the point.
@Injectable()
export class AccountThrottlerGuard implements CanActivate {
  constructor(
    @InjectThrottlerStorage() private readonly storage: ThrottlerStorage,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const userId: string = req.user.id;
    const key = `${THROTTLER_NAME}:${userId}`;
    const { isBlocked } = await this.storage.increment(
      key,
      TTL_MS,
      LIMIT,
      TTL_MS,
      THROTTLER_NAME,
    );
    if (isBlocked) {
      throw new ThrottlerException();
    }
    return true;
  }
}
