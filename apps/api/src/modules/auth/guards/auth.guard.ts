import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import type { EnvironmentVariables } from '../../../config/env.validation';
import { UserLookupService } from '../../users/user-lookup.service';
import { type AuthenticatedRequest, IS_PUBLIC } from '../decorators';
import { clearSessionCookieOptions, SESSION_COOKIE } from '../session-cookie';
import { SessionService } from '../session.service';
import { credentialFingerprint } from '../tokens';

/**
 * Every route needs a valid session unless marked @Public(). The user is read from PostgreSQL
 * on every request (closed users excluded), so role changes and closures apply immediately. A
 * session is valid only while the user's password hash matches the one it was created with, so a
 * password change ends every session, even one stored by a login that raced the change.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    private readonly users: UserLookupService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const sessionId: unknown = req.signedCookies?.[SESSION_COOKIE];

    if (typeof sessionId === 'string' && sessionId !== '') {
      const session = await this.sessions.get(sessionId);
      const user = session ? await this.users.findActiveById(session.userId) : null;
      if (
        session &&
        user?.passwordHash &&
        session.credentialFingerprint === credentialFingerprint(user.passwordHash)
      ) {
        const authed = req as AuthenticatedRequest;
        authed.user = user;
        authed.sessionId = sessionId;
        return true;
      }
      // Created with credentials that are no longer current (e.g. a login that raced a reset).
      if (session) await this.sessions.destroy(sessionId);
    }

    // A cookie was sent but is invalid, tampered with or expired: tell the browser to drop it.
    if (sessionId !== undefined || req.cookies?.[SESSION_COOKIE] !== undefined) {
      http
        .getResponse<Response>()
        .clearCookie(
          SESSION_COOKIE,
          clearSessionCookieOptions(this.config.get('NODE_ENV', { infer: true })),
        );
    }
    throw new UnauthorizedException('Not signed in');
  }
}
