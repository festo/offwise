import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '../users/entities/user.entity';

export const IS_PUBLIC = 'offwise:isPublic';
export const IS_ADMIN_ONLY = 'offwise:isAdminOnly';

/** The route needs no session (AuthGuard lets it through). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** The route needs a signed-in user with role `admin` (AdminGuard). */
export const AdminOnly = () => SetMetadata(IS_ADMIN_ONLY, true);

/** A request that passed AuthGuard. */
export type AuthenticatedRequest = Request & { user: User; sessionId: string };

/** The signed-in user that AuthGuard attached to the request. */
export const AuthUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User =>
    ctx.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
