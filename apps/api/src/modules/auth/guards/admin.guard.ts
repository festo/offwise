import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type AuthenticatedRequest, IS_ADMIN_ONLY } from '../decorators';

/** Routes marked @AdminOnly() need role `admin`. Runs after AuthGuard, so req.user is set. */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const adminOnly = this.reflector.getAllAndOverride<boolean | undefined>(IS_ADMIN_ONLY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!adminOnly) return true;
    const user = context.switchToHttp().getRequest<Partial<AuthenticatedRequest>>().user;
    if (user?.role === 'admin') return true;
    throw new ForbiddenException('Administrators only');
  }
}
