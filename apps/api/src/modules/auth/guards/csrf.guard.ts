import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CSRF_HEADER, CSRF_HEADER_VALUE } from '@offwise/shared';
import type { Request } from 'express';
import type { EnvironmentVariables } from '../../../config/env.validation';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * State-changing requests must carry `X-Requested-With: offwise` and come from our own origin:
 * `Sec-Fetch-Site` must be `same-origin` when present, otherwise `Origin` must match PUBLIC_URL.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly origin: string;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.origin = new URL(config.get('PUBLIC_URL', { infer: true })).origin;
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method.toUpperCase())) return true;

    if (req.header(CSRF_HEADER) !== CSRF_HEADER_VALUE) {
      throw new ForbiddenException('Missing or invalid X-Requested-With header');
    }

    const site = req.header('Sec-Fetch-Site');
    if (site !== undefined) {
      if (site === 'same-origin') return true;
      throw new ForbiddenException('Cross-origin request rejected');
    }

    const origin = req.header('Origin');
    if (origin !== undefined && origin === this.origin) return true;
    throw new ForbiddenException('Cross-origin request rejected');
  }
}
