import { describe, expect, it } from 'vitest';
import { sessionLifetime } from './session-lifetime';

const DAY = 24 * 3600_000;

describe('sessionLifetime', () => {
  it('converts the configured days to milliseconds', () => {
    expect(sessionLifetime({ SESSION_IDLE_TIMEOUT_DAYS: 7, SESSION_MAX_AGE_DAYS: 30 })).toEqual({
      idleMs: 7 * DAY,
      absoluteMs: 30 * DAY,
    });
  });
});
