import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppConfigModule } from '../src/config/app-config.module';
import { AuthCoreModule } from '../src/modules/auth/auth-core.module';
import {
  loginEmailKey,
  loginIpKey,
  resetEmailKey,
  resetIpKey,
  ThrottleService,
} from '../src/modules/auth/throttle.service';
import { RedisModule } from '../src/redis/redis.module';
import { REDIS } from '../src/redis/redis.constants';
import { flushTestRedis } from './utils/redis';

describe('ThrottleService (e2e)', () => {
  let app: INestApplication;
  let throttle: ThrottleService;
  let redis: Redis;
  const key = loginEmailKey('A@Example.com');

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [AppConfigModule, RedisModule, AuthCoreModule],
    }).compile();
    app = mod.createNestApplication();
    await app.init();
    throttle = app.get(ThrottleService);
    redis = app.get<Redis>(REDIS);
  });
  beforeEach(flushTestRedis);
  afterAll(async () => {
    await app.close();
  });

  it('builds lowercase keys', () => {
    expect(key).toBe('throttle:login:email:a@example.com');
  });

  it('builds ip and reset keys', () => {
    expect(loginIpKey('10.0.0.1')).toBe('throttle:login:ip:10.0.0.1');
    expect(resetEmailKey('A@Example.com')).toBe('throttle:reset:email:a@example.com');
    expect(resetIpKey('10.0.0.1')).toBe('throttle:reset:ip:10.0.0.1');
  });

  it('repairs a counter that has no TTL on the next hit', async () => {
    await redis.set(key, '2');
    expect(await redis.ttl(key)).toBe(-1);
    await throttle.hit(key, 5, 900);
    const ttl = await redis.ttl(key);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(900);
  });

  it('does not extend the window on later hits', async () => {
    await throttle.hit(key, 5, 900);
    await redis.expire(key, 100);
    await throttle.hit(key, 5, 900);
    expect(await redis.ttl(key)).toBeLessThanOrEqual(100);
  });

  it('allows 5 hits and rejects the 6th with retryAfterSec', async () => {
    for (let i = 0; i < 5; i++) expect((await throttle.hit(key, 5, 900)).allowed).toBe(true);
    const sixth = await throttle.hit(key, 5, 900);
    expect(sixth.allowed).toBe(false);
    expect(sixth.retryAfterSec).toBeGreaterThan(0);
    expect(sixth.retryAfterSec).toBeLessThanOrEqual(900);
  });

  it('clear resets', async () => {
    for (let i = 0; i < 5; i++) await throttle.hit(key, 5, 900);
    await throttle.clear(key);
    expect((await throttle.hit(key, 5, 900)).allowed).toBe(true);
  });

  it('giveBack returns one hit, keeps the TTL and never goes below 0 or creates a key', async () => {
    await throttle.giveBack(key);
    expect(await redis.exists(key)).toBe(0);
    await throttle.hit(key, 5, 900);
    await throttle.hit(key, 5, 900);
    await throttle.giveBack(key);
    expect(await redis.get(key)).toBe('1');
    expect(await redis.ttl(key)).toBeGreaterThan(0);
    await throttle.giveBack(key);
    await throttle.giveBack(key);
    expect(await redis.get(key)).toBe('0');
  });
});
