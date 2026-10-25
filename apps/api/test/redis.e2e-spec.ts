import type { INestApplication } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { REDIS } from '../src/redis/redis.constants';
import { createTestApp } from './utils/create-test-app';
import { flushTestRedis } from './utils/redis';

describe('Redis client (e2e)', () => {
  let app: INestApplication;
  let redis: Redis;

  beforeAll(async () => {
    app = await createTestApp();
    redis = app.get<Redis>(REDIS);
  });

  beforeEach(async () => {
    await flushTestRedis();
  });

  afterAll(async () => {
    await app.close();
  });

  it('uses the dedicated test database', () => {
    expect(redis.options.db).toBe(1);
  });

  it('can SET and GET a value', async () => {
    await redis.set('e2e:key', 'value');
    expect(await redis.get('e2e:key')).toBe('value');
  });

  it('flushTestRedis empties the test database', async () => {
    await redis.set('e2e:key', 'value');
    await flushTestRedis();
    expect(await redis.get('e2e:key')).toBeNull();
  });
});
