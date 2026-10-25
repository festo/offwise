import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Redis, RedisKey } from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppConfigModule } from '../src/config/app-config.module';
import { AuthCoreModule } from '../src/modules/auth/auth-core.module';
import {
  BOOTSTRAP_RESET_TTL_SEC,
  RESET_TTL_SEC,
  ResetTokenService,
} from '../src/modules/auth/reset-token.service';
import { hashToken } from '../src/modules/auth/tokens';
import { RedisModule } from '../src/redis/redis.module';
import { REDIS } from '../src/redis/redis.constants';
import { flushTestRedis } from './utils/redis';

describe('ResetTokenService (e2e)', () => {
  let app: INestApplication;
  let resets: ResetTokenService;
  let redis: Redis;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [AppConfigModule, RedisModule, AuthCoreModule],
    }).compile();
    app = mod.createNestApplication();
    await app.init();
    resets = app.get(ResetTokenService);
    redis = app.get<Redis>(REDIS);
  });
  beforeEach(flushTestRedis);
  afterAll(async () => {
    await app.close();
  });

  it('consume returns the userId once, then null', async () => {
    const token = await resets.create('u1');
    expect(await resets.consume(token)).toBe('u1');
    expect(await resets.consume(token)).toBeNull();
  });

  it('revokeAllForUser invalidates outstanding tokens', async () => {
    const a = await resets.create('u1');
    const b = await resets.create('u1');
    const other = await resets.create('u2');
    await resets.revokeAllForUser('u1');
    expect(await resets.consume(a)).toBeNull();
    expect(await resets.consume(b)).toBeNull();
    expect(await resets.consume(other)).toBe('u2');
  });

  it('stores only hashes in Redis', async () => {
    const token = await resets.create('u1', 86400);
    const keys = await redis.keys('*');
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.some((k) => k.includes(token))).toBe(false);
    for (const k of keys) {
      if (k.startsWith('password-reset:')) expect(k).toMatch(/^password-reset:[0-9a-f]{64}$/);
    }
  });

  it('token TTL is about 3600 by default and 86400 for bootstrap', async () => {
    const a = await resets.create('u1');
    const b = await resets.create('u2', BOOTSTRAP_RESET_TTL_SEC);
    const ttl = (t: string) => redis.ttl(`password-reset:${hashToken(t)}`);
    expect(await ttl(a)).toBeGreaterThan(3590);
    expect(await ttl(a)).toBeLessThanOrEqual(RESET_TTL_SEC);
    expect(await ttl(b)).toBeGreaterThan(86390);
    expect(await ttl(b)).toBeLessThanOrEqual(86400);
  });

  it('user set TTL tracks the longest-lived token', async () => {
    await resets.create('u1', 86400);
    await resets.create('u1');
    expect(await redis.ttl('user-resets:u1')).toBeGreaterThan(86390);
  });

  it('revokeAllForUser keeps members added after it read the set', async () => {
    await resets.create('u1');
    const smembers = redis.smembers.bind(redis);
    vi.spyOn(redis, 'smembers').mockImplementation(async (k: RedisKey) => {
      const res = await smembers(k);
      await redis.sadd(k, 'late-hash');
      return res;
    });
    await resets.revokeAllForUser('u1');
    vi.restoreAllMocks();
    expect(await redis.smembers('user-resets:u1')).toEqual(['late-hash']);
  });
});
