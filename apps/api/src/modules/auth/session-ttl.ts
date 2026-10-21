import type { SessionLifetime } from '../../config/session-lifetime';

/** Remaining lifetime in ms; 0 or less means the session is expired. */
export function sessionTtlMs(createdAt: number, now: number, lifetime: SessionLifetime): number {
  return Math.min(lifetime.idleMs, createdAt + lifetime.absoluteMs - now);
}
