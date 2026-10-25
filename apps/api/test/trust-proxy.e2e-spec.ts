import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestApp } from './utils/create-test-app';
import { api } from './utils/http';
import { flushTestRedis } from './utils/redis';
import { resetDatabase } from './utils/reset-database';

// Set before the app modules are imported: the config is validated when AppConfigModule loads.
const previous = vi.hoisted(() => {
  const value = process.env.TRUST_PROXY;
  process.env.TRUST_PROXY = 'false';
  return value;
});

describe('TRUST_PROXY=false (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    await resetDatabase(dataSource);
    await flushTestRedis();
  });

  afterAll(async () => {
    await app.close();
    if (previous === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = previous;
  });

  const fail = (email: string, forwardedFor: string) =>
    api(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', forwardedFor)
      .send({ email, password: 'wrong password!!' });

  it('ignores X-Forwarded-For: every client counts as the connecting address', async () => {
    for (let i = 0; i < 30; i++) {
      expect((await fail(`user-${i}@example.test`, `203.0.113.${i + 1}`)).status).toBe(401);
    }
    expect((await fail('user-30@example.test', '198.51.100.7')).status).toBe(429);
  });
});
