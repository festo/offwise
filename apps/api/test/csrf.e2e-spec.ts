import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp } from './utils/create-test-app';
import { flushTestRedis, TEST_PUBLIC_URL } from './utils/redis';
import { resetDatabase } from './utils/reset-database';

const body = { email: 'someone@example.test', password: 'correct horse battery' };

describe('CSRF guard (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app.get(DataSource));
    await flushTestRedis();
  });

  afterAll(async () => {
    await app.close();
  });

  const login = () => request(app.getHttpServer()).post('/api/auth/login');

  it('rejects a POST without X-Requested-With', async () => {
    await login().set('Origin', TEST_PUBLIC_URL).send(body).expect(403);
  });

  it('rejects a foreign Origin', async () => {
    await login()
      .set('X-Requested-With', 'offwise')
      .set('Origin', 'https://evil.example')
      .send(body)
      .expect(403);
  });

  it('rejects Sec-Fetch-Site: cross-site', async () => {
    await login()
      .set('X-Requested-With', 'offwise')
      .set('Sec-Fetch-Site', 'cross-site')
      .set('Origin', TEST_PUBLIC_URL)
      .send(body)
      .expect(403);
  });

  it('lets a same-origin request through to the handler', async () => {
    const res = await login()
      .set('X-Requested-With', 'offwise')
      .set('Origin', TEST_PUBLIC_URL)
      .send(body);
    expect(res.status).not.toBe(403);
    expect(res.status).toBe(401);
  });

  it('lets Sec-Fetch-Site: same-origin through', async () => {
    const res = await login()
      .set('X-Requested-With', 'offwise')
      .set('Sec-Fetch-Site', 'same-origin')
      .send(body);
    expect(res.status).toBe(401);
  });
});
