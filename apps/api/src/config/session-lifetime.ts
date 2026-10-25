import type { EnvironmentVariables } from './env.validation';

const DAY_MS = 24 * 3600_000;

/** How long a session lives: a sliding idle timeout, capped at an absolute age since sign-in. */
export interface SessionLifetime {
  idleMs: number;
  absoluteMs: number;
}

export function sessionLifetime(
  env: Pick<EnvironmentVariables, 'SESSION_IDLE_TIMEOUT_DAYS' | 'SESSION_MAX_AGE_DAYS'>,
): SessionLifetime {
  return {
    idleMs: env.SESSION_IDLE_TIMEOUT_DAYS * DAY_MS,
    absoluteMs: env.SESSION_MAX_AGE_DAYS * DAY_MS,
  };
}
