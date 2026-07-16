import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { SessionService } from './session.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly session: SessionService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const userId = this.session.extractUserId(req);
    if (!userId) {
      throw new UnauthorizedException();
    }

    req.user = { id: userId };
    return true;
  }
}
