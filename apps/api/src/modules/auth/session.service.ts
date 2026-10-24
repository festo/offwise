import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';
import type { EnvironmentVariables } from '../../config/env.validation';
import { type SessionLifetime, sessionLifetime } from '../../config/session-lifetime';
import { REDIS } from '../../redis/redis.constants';
import { sessionTtlMs } from './session-ttl';
import { hashToken, newToken } from './tokens';

export interface SessionData {
  userId: string;
  /** credentialFingerprint() of the password hash the session was created with. */
  credentialFingerprint: string;
  createdAt: number;
  lastSeenAt: number;
}

const sessionKey = (hash: string) => `session:${hash}`;
const userSessionsKey = (userId: string) => `user-sessions:${userId}`;

/** lastSeenAt and the TTL are refreshed at most this often, not on every request. */
const TOUCH_INTERVAL_MS = 60_000;

// Refresh lastSeenAt and TTL only if the session still exists (never recreate a partial hash).
const TOUCH_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 1 then
  redis.call('HSET', KEYS[1], 'lastSeenAt', ARGV[1])
  redis.call('PEXPIRE', KEYS[1], ARGV[2])
  return 1
end
return 0`;

@Injectable()
export class SessionService {
  readonly lifetime: SessionLifetime;

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.lifetime = sessionLifetime({
      SESSION_IDLE_TIMEOUT_DAYS: config.get('SESSION_IDLE_TIMEOUT_DAYS', { infer: true }),
      SESSION_MAX_AGE_DAYS: config.get('SESSION_MAX_AGE_DAYS', { infer: true }),
    });
  }

  async create(userId: string, credentialFingerprint: string): Promise<string> {
    const id = newToken();
    const hash = hashToken(id);
    const now = Date.now();
    await this.redis
      .multi()
      .hset(sessionKey(hash), {
        userId,
        credentialFingerprint,
        createdAt: String(now),
        lastSeenAt: String(now),
      })
      .pexpire(sessionKey(hash), sessionTtlMs(now, now, this.lifetime))
      .sadd(userSessionsKey(userId), hash)
      .pexpire(userSessionsKey(userId), this.lifetime.absoluteMs)
      .exec();
    return id;
  }

  async get(id: string): Promise<SessionData | null> {
    const hash = hashToken(id);
    const raw = await this.redis.hgetall(sessionKey(hash));
    if (!raw.userId) return null;
    // Sessions created before credential binding have no fingerprint: treat them as invalid.
    if (!raw.credentialFingerprint) {
      await this.destroy(id);
      return null;
    }
    const data: SessionData = {
      userId: raw.userId,
      credentialFingerprint: raw.credentialFingerprint,
      createdAt: Number(raw.createdAt),
      lastSeenAt: Number(raw.lastSeenAt),
    };
    const now = Date.now();
    const ttl = sessionTtlMs(data.createdAt, now, this.lifetime);
    if (ttl <= 0) {
      await this.destroy(id);
      return null;
    }
    if (now - data.lastSeenAt >= TOUCH_INTERVAL_MS) {
      data.lastSeenAt = now;
      await this.redis.eval(TOUCH_SCRIPT, 1, sessionKey(hash), String(now), String(ttl));
    }
    return data;
  }

  async destroy(id: string): Promise<void> {
    const hash = hashToken(id);
    const userId = await this.redis.hget(sessionKey(hash), 'userId');
    const multi = this.redis.multi().del(sessionKey(hash));
    if (userId) multi.srem(userSessionsKey(userId), hash);
    await multi.exec();
  }

  async destroyAllForUser(userId: string): Promise<void> {
    const hashes = await this.redis.smembers(userSessionsKey(userId));
    if (hashes.length === 0) return;
    const multi = this.redis.multi();
    for (const h of hashes) multi.del(sessionKey(h));
    multi.srem(userSessionsKey(userId), ...hashes);
    await multi.exec();
  }
}
