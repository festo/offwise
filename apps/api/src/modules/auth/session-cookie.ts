import type { CookieOptions } from 'express';
import type { EnvironmentVariables } from '../../config/env.validation';

export const SESSION_COOKIE = 'offwise_session';

/** Options for clearing the cookie: the same scope attributes, without expiry or signing. */
export function clearSessionCookieOptions(
  nodeEnv: EnvironmentVariables['NODE_ENV'],
): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure: nodeEnv !== 'development', path: '/api' };
}

/** Max-Age is the absolute cap; the server-side TTL decides whether the session is still valid. */
export function sessionCookieOptions(
  nodeEnv: EnvironmentVariables['NODE_ENV'],
  maxAgeMs: number,
): CookieOptions {
  return { ...clearSessionCookieOptions(nodeEnv), signed: true, maxAge: maxAgeMs };
}
