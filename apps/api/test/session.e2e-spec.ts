import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Redis, RedisKey } from 'ioredis';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppConfigModule } from '../src/config/app-config.module';
import { AuthCoreModule } from '../src/modules/auth/auth-core.module';
import { SessionService } from '../src/modules/auth/session.service';
import { hashToken } from '../src/modules/auth/tokens';
import { RedisModule } from '../src/redis/redis.module';
import { REDIS } from '../src/redis/redis.constants';
import { flushTestRedis } from './utils/redis';

const DAY = 24 * 3600_000;

describe('SessionService (e2e)', () => {
  let app: INestApplication;
  let sessions: SessionService;
  let redis: Redis;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [AppConfigModule, RedisModule, AuthCoreModule],
    }).compile();
    app = mod.createNestApplication();
    await app.init();
    sessions = app.get(SessionService);
    redis = app.get<Redis>(REDIS);
  });
  beforeEach(flushTestRedis);
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await app.close();
  });

  it('creates a session and reads it back', async () => {
    const id = await sessions.create('u1');
    const data = await sessions.get(id);
    expect(data?.userId).toBe('u1');
    expect(await redis.keys('*')).not.toContain(`session:${id}`);
  });

  it('destroy removes the session', async () => {
    const id = await sessions.create('u1');
    await sessions.destroy(id);
    expect(await sessions.get(id)).toBeNull();
    expect(await redis.sismember('user-sessions:u1', hashToken(id))).toBe(0);
  });

  it('destroyAllForUser only removes that user sessions', async () => {
    const a = await sessions.create('u1');
    const b = await sessions.create('u1');
    const c = await sessions.create('u2');
    await sessions.destroyAllForUser('u1');
    expect(await sessions.get(a)).toBeNull();
    expect(await sessions.get(b)).toBeNull();
    expect((await sessions.get(c))?.userId).toBe('u2');
    expect(await redis.exists('user-sessions:u1')).toBe(0);
  });

  it('sets a TTL of at most 7 days', async () => {
    const id = await sessions.create('u1');
    const ttl = await redis.pttl(`session:${hashToken(id)}`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(7 * DAY);
  });

  it('returns null and deletes past the absolute cap', async () => {
    const id = await sessions.create('u1');
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 31 * DAY);
    expect(await sessions.get(id)).toBeNull();
    vi.restoreAllMocks();
    expect(await redis.exists(`session:${hashToken(id)}`)).toBe(0);
  });

  it('refreshes lastSeenAt only after 60 seconds', async () => {
    const id = await sessions.create('u1');
    const first = (await sessions.get(id))!;
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 30_000);
    expect((await sessions.get(id))!.lastSeenAt).toBe(first.lastSeenAt);
    vi.spyOn(Date, 'now').mockReturnValue(now + 61_000);
    await sessions.get(id);
    vi.restoreAllMocks();
    const stored = await redis.hget(`session:${hashToken(id)}`, 'lastSeenAt');
    expect(Number(stored)).toBeGreaterThanOrEqual(now + 61_000);
  });

  it('touch refreshes the TTL', async () => {
    const id = await sessions.create('u1');
    const key = `session:${hashToken(id)}`;
    await redis.hset(key, 'lastSeenAt', String(Date.now() - 120_000));
    await redis.pexpire(key, 1_000_000);
    await sessions.get(id);
    expect(await redis.pttl(key)).toBeGreaterThan(1_000_000);
  });

  it('touch never recreates a deleted session', async () => {
    const id = await sessions.create('u1');
    const key = `session:${hashToken(id)}`;
    await redis.hset(key, 'lastSeenAt', String(Date.now() - 120_000));
    const hgetall = redis.hgetall.bind(redis);
    vi.spyOn(redis, 'hgetall').mockImplementation(async (k: RedisKey) => {
      const res = await hgetall(k);
      await redis.del(key);
      return res;
    });
    await sessions.get(id);
    vi.restoreAllMocks();
    expect(await redis.exists(key)).toBe(0);
  });

  it('create prunes stale members of the user set', async () => {
    await redis.sadd('user-sessions:u1', 'stale-hash');
    const id = await sessions.create('u1');
    expect(await redis.smembers('user-sessions:u1')).toEqual([hashToken(id)]);
    expect(await redis.exists(`session:${hashToken(id)}`)).toBe(1);
  });

  it('destroyAllForUser keeps members added after it read the set', async () => {
    await sessions.create('u1');
    const smembers = redis.smembers.bind(redis);
    vi.spyOn(redis, 'smembers').mockImplementation(async (k: RedisKey) => {
      const res = await smembers(k);
      await redis.sadd(k, 'late-hash');
      return res;
    });
    await sessions.destroyAllForUser('u1');
    vi.restoreAllMocks();
    expect(await redis.smembers('user-sessions:u1')).toEqual(['late-hash']);
  });
});
