import { describe, expect, it } from 'vitest';
import { sessionTtlMs } from './session-ttl';

const DAY = 24 * 3600_000;
const lifetime = { idleMs: 7 * DAY, absoluteMs: 30 * DAY };

describe('sessionTtlMs', () => {
  const created = 1_000_000_000_000;

  it('gives a new session the idle timeout', () => {
    expect(sessionTtlMs(created, created, lifetime)).toBe(7 * DAY);
  });

  it('is capped by the absolute limit near the end (29 days old -> 1 day)', () => {
    expect(sessionTtlMs(created, created + 29 * DAY, lifetime)).toBe(DAY);
  });

  it('is 0 at the absolute limit and negative after', () => {
    expect(sessionTtlMs(created, created + 30 * DAY, lifetime)).toBe(0);
    expect(sessionTtlMs(created, created + 31 * DAY, lifetime)).toBeLessThan(0);
  });

  it('follows a configured lifetime', () => {
    const short = { idleMs: DAY, absoluteMs: 2 * DAY };
    expect(sessionTtlMs(created, created, short)).toBe(DAY);
    expect(sessionTtlMs(created, created + 1.5 * DAY, short)).toBe(0.5 * DAY);
  });
});
