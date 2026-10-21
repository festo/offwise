import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS } from '../../redis/redis.constants';
import { hashToken, newToken } from './tokens';

export const RESET_TTL_SEC = 3600;
export const BOOTSTRAP_RESET_TTL_SEC = 86400;

const resetKey = (hash: string) => `password-reset:${hash}`;
const userResetsKey = (userId: string) => `user-resets:${userId}`;

@Injectable()
export class ResetTokenService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async create(userId: string, ttlSec = RESET_TTL_SEC): Promise<string> {
    const token = newToken();
    const hash = hashToken(token);
    // The set lives as long as the longest-lived token it indexes (NX sets it, GT only extends it).
    await this.redis
      .multi()
      .set(resetKey(hash), userId, 'EX', ttlSec)
      .sadd(userResetsKey(userId), hash)
      .expire(userResetsKey(userId), ttlSec, 'NX')
      .expire(userResetsKey(userId), ttlSec, 'GT')
      .exec();
    return token;
  }

  /** Single use: returns the userId and invalidates the token, or null. */
  async consume(token: string): Promise<string | null> {
    const hash = hashToken(token);
    const userId = await this.redis.getdel(resetKey(hash));
    if (userId) await this.redis.srem(userResetsKey(userId), hash);
    return userId;
  }

  async revokeAllForUser(userId: string): Promise<void> {
    const hashes = await this.redis.smembers(userResetsKey(userId));
    const multi = this.redis.multi();
    for (const h of hashes) multi.del(resetKey(h));
    if (hashes.length > 0) multi.srem(userResetsKey(userId), ...hashes);
    await multi.exec();
  }
}
