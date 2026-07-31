import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from './current-user.decorator';

// temporary beta gate — see DIET_BETA_USER_EMAIL in AuthService.authenticate().
// Must run after AuthGuard, which populates req.user.dietEnabled
@Injectable()
export class DietEnabledGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user: AuthenticatedUser = req.user;
    if (!user.dietEnabled) {
      throw new ForbiddenException();
    }
    return true;
  }
}
