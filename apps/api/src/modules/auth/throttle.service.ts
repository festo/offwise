import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS } from '../../redis/redis.constants';

export const LOGIN_EMAIL_LIMIT = 5;
export const LOGIN_IP_LIMIT = 30;
export const LOGIN_WINDOW_SEC = 900;
export const RESET_EMAIL_LIMIT = 3;
export const RESET_WINDOW_SEC = 3600;

export const loginEmailKey = (email: string) => `throttle:login:email:${email.toLowerCase()}`;
export const loginIpKey = (ip: string) => `throttle:login:ip:${ip}`;
export const resetEmailKey = (email: string) => `throttle:reset:email:${email.toLowerCase()}`;

/** DECR only an existing positive counter: never below 0, never creates a key without a TTL. */
const GIVE_BACK_SCRIPT = `
local count = tonumber(redis.call('GET', KEYS[1]) or '0')
if count and count > 0 then return redis.call('DECR', KEYS[1]) end
return 0
`;

@Injectable()
export class ThrottleService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async hit(
    key: string,
    limit: number,
    windowSec: number,
  ): Promise<{ allowed: boolean; retryAfterSec: number }> {
    // Atomic: every hit guarantees the counter has a TTL (EXPIRE NX only sets one if missing).
    const res = await this.redis.multi().incr(key).expire(key, windowSec, 'NX').ttl(key).exec();
    const count = Number(res?.[0]?.[1] ?? 0);
    const ttl = Number(res?.[2]?.[1] ?? -1);
    return { allowed: count <= limit, retryAfterSec: ttl > 0 ? ttl : windowSec };
  }

  /** Returns one hit to the budget (keeps the window's TTL). */
  async giveBack(key: string): Promise<void> {
    await this.redis.eval(GIVE_BACK_SCRIPT, 1, key);
  }

  async clear(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
