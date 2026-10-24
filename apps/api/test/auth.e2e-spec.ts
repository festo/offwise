import type { INestApplication } from '@nestjs/common';
import { hash, parseOptions } from '@node-rs/argon2';
import type { CurrentUser } from '@offwise/shared';
import request from 'supertest';
import { DataSource } from 'typeorm';
import type { Redis } from 'ioredis';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditEvent } from '../src/audit/audit-event.entity';
import { ARGON2_OPTIONS, PasswordService } from '../src/modules/auth/password.service';
import { SessionService } from '../src/modules/auth/session.service';
import { hashToken } from '../src/modules/auth/tokens';
import { User } from '../src/modules/users/entities/user.entity';
import { REDIS } from '../src/redis/redis.constants';
import { createTestApp } from './utils/create-test-app';
import { createUser } from './utils/factories';
import { api, sessionCookieFrom, signIn } from './utils/http';
import { flushTestRedis } from './utils/redis';
import { resetDatabase } from './utils/reset-database';

const PASSWORD = 'correct horse battery';
const INVALID = 'Invalid email or password';

function setCookies(res: request.Response): string[] {
  const raw = res.headers['set-cookie'] as unknown as string[] | string | undefined;
  return Array.isArray(raw) ? raw : raw ? [raw] : [];
}

describe('Auth (e2e)', () => {
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  const auditActions = async () =>
    (await dataSource.getRepository(AuditEvent).find({ order: { occurredAt: 'ASC' } })).map(
      (e) => e.action,
    );

  describe('POST /api/auth/login', () => {
    it('returns the current user and sets the session cookie', async () => {
      const user = await createUser(dataSource, {
        name: 'Ada Lovelace',
        email: 'Ada@Example.test',
        password: PASSWORD,
      });

      const res = await api(app)
        .post('/api/auth/login')
        .send({ email: 'ada@example.test', password: PASSWORD })
        .expect(200);

      expect(res.body).toEqual({
        id: user.id,
        name: 'Ada Lovelace',
        email: 'Ada@Example.test',
        role: 'employee',
        locale: 'en-GB',
        timeZone: 'UTC',
      } satisfies CurrentUser);

      const cookie = setCookies(res).find((c) => c.startsWith('offwise_session='));
      expect(cookie).toBeDefined();
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Path=/api');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Max-Age=2592000');
      expect(cookie).toContain('Secure');
    });

    it('applies the user locale and time zone when set', async () => {
      await createUser(dataSource, {
        email: 'fr@example.test',
        password: PASSWORD,
        locale: 'fr-FR',
        timeZone: 'Europe/Paris',
      });
      const res = await api(app)
        .post('/api/auth/login')
        .send({ email: 'fr@example.test', password: PASSWORD })
        .expect(200);
      expect(res.body).toMatchObject({
        locale: 'fr-FR',
        timeZone: 'Europe/Paris',
      });
    });

    it('rejects a wrong password, unknown email, missing password and closed user alike', async () => {
      await createUser(dataSource, { email: 'a@example.test', password: PASSWORD });
      await createUser(dataSource, { email: 'nopass@example.test' });
      const closed = await createUser(dataSource, {
        email: 'closed@example.test',
        password: PASSWORD,
      });
      await dataSource.getRepository(User).softDelete(closed.id);

      for (const body of [
        { email: 'a@example.test', password: 'wrong password!!' },
        { email: 'nobody@example.test', password: PASSWORD },
        { email: 'nopass@example.test', password: PASSWORD },
        { email: 'closed@example.test', password: PASSWORD },
      ]) {
        const res = await api(app).post('/api/auth/login').send(body).expect(401);
        expect(res.body.message).toBe(INVALID);
        expect(sessionCookieFrom(res)).toBeUndefined();
      }
    });

    it('rejects an invalid body with 400', async () => {
      await api(app).post('/api/auth/login').send({ email: 'not-an-email' }).expect(400);
    });

    it('throttles after 5 failed attempts for the email, even with the right password', async () => {
      await createUser(dataSource, { email: 'a@example.test', password: PASSWORD });
      for (let i = 0; i < 5; i++) {
        await api(app)
          .post('/api/auth/login')
          .send({ email: 'a@example.test', password: 'wrong password!!' })
          .expect(401);
      }
      const res = await api(app)
        .post('/api/auth/login')
        .send({ email: 'A@example.test', password: PASSWORD })
        .expect(429);
      expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
      expect(res.body).toMatchObject({
        statusCode: 429,
        message: 'Too many attempts. Try again later.',
      });
      expect(res.body.retryAfter).toBeGreaterThan(0);
    });

    it('lets at most 5 of 10 concurrent wrong-password attempts through to verification', async () => {
      await createUser(dataSource, { email: 'a@example.test', password: PASSWORD });
      const results = await Promise.all(
        Array.from({ length: 10 }, () =>
          api(app)
            .post('/api/auth/login')
            .send({ email: 'a@example.test', password: 'wrong password!!' }),
        ),
      );
      const statuses = results.map((r) => r.status);
      expect(statuses.filter((s) => s === 401).length).toBeLessThanOrEqual(5);
      expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(5);
      expect(statuses.every((s) => s === 401 || s === 429)).toBe(true);
    });

    it('resets the email counter after a successful login', async () => {
      await createUser(dataSource, { email: 'a@example.test', password: PASSWORD });
      for (let i = 0; i < 3; i++) {
        await api(app)
          .post('/api/auth/login')
          .send({ email: 'a@example.test', password: 'wrong password!!' })
          .expect(401);
      }
      await api(app)
        .post('/api/auth/login')
        .send({ email: 'a@example.test', password: PASSWORD })
        .expect(200);
      for (let i = 0; i < 5; i++) {
        await api(app)
          .post('/api/auth/login')
          .send({ email: 'a@example.test', password: 'wrong password!!' })
          .expect(401);
      }
      await api(app)
        .post('/api/auth/login')
        .send({ email: 'a@example.test', password: 'wrong password!!' })
        .expect(429);
    });

    describe('per-IP throttle', () => {
      const fail = (email: string, forwardedFor?: string) => {
        const req = api(app).post('/api/auth/login');
        if (forwardedFor) req.set('X-Forwarded-For', forwardedFor);
        return req.send({ email, password: 'wrong password!!' });
      };

      it('does not count successful logins against the IP', async () => {
        await createUser(dataSource, { email: 'a@example.test', password: PASSWORD });
        for (let i = 0; i < 31; i++) {
          const res = await api(app)
            .post('/api/auth/login')
            .send({ email: 'a@example.test', password: PASSWORD });
          expect(res.status, `login ${i + 1}`).toBe(200);
        }
      });

      it('limits failed attempts from one IP to 30, across emails', async () => {
        for (let i = 0; i < 30; i++) {
          expect((await fail(`user-${i}@example.test`)).status, `attempt ${i + 1}`).toBe(401);
        }
        const res = await fail('user-30@example.test');
        expect(res.status).toBe(429);
        expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
      });

      it('counts X-Forwarded-For clients behind a trusted loopback proxy separately', async () => {
        for (let i = 0; i < 30; i++) {
          expect((await fail(`user-${i}@example.test`, '203.0.113.1')).status).toBe(401);
        }
        expect((await fail('user-30@example.test', '203.0.113.1')).status).toBe(429);
        expect((await fail('user-31@example.test', '203.0.113.2')).status).toBe(401);
      });
    });

    it('destroys the previous session when a signed-in client logs in again', async () => {
      await createUser(dataSource, { email: 'a@example.test', password: PASSWORD });
      const { cookie: oldCookie } = await signIn(app, 'a@example.test', PASSWORD);
      const res = await api(app)
        .post('/api/auth/login')
        .set('Cookie', oldCookie)
        .send({ email: 'a@example.test', password: PASSWORD })
        .expect(200);
      const newCookie = sessionCookieFrom(res)!;
      expect(newCookie).not.toBe(oldCookie);
      await api(app).get('/api/auth/me').set('Cookie', oldCookie).expect(401);
      await api(app).get('/api/auth/me').set('Cookie', newCookie).expect(200);
    });

    it('keeps the previous session when the new login fails', async () => {
      await createUser(dataSource, { email: 'a@example.test', password: PASSWORD });
      const { cookie: oldCookie } = await signIn(app, 'a@example.test', PASSWORD);
      await api(app)
        .post('/api/auth/login')
        .set('Cookie', oldCookie)
        .send({ email: 'a@example.test', password: 'wrong password!!' })
        .expect(401);
      await api(app).get('/api/auth/me').set('Cookie', oldCookie).expect(200);
    });

    it('creates no session and no success audit when discarding the previous session fails', async () => {
      await createUser(dataSource, { email: 'a@example.test', password: PASSWORD });
      const { cookie: oldCookie } = await signIn(app, 'a@example.test', PASSWORD);
      const sessions = app.get(SessionService);
      vi.spyOn(sessions, 'destroy').mockRejectedValueOnce(new Error('redis down'));
      const create = vi.spyOn(sessions, 'create');

      const res = await api(app)
        .post('/api/auth/login')
        .set('Cookie', oldCookie)
        .send({ email: 'a@example.test', password: PASSWORD })
        .expect(500);

      expect(sessionCookieFrom(res)).toBeUndefined();
      expect(create).not.toHaveBeenCalled();
      expect(await app.get<Redis>(REDIS).keys('session:*')).toHaveLength(1);
      expect(await auditActions()).toEqual(['auth.login_succeeded']);
    });

    it('rehashes a password stored with outdated parameters', async () => {
      const weak = await hash(PASSWORD, { ...ARGON2_OPTIONS, timeCost: 1 });
      const user = await createUser(dataSource, { email: 'old@example.test', passwordHash: weak });

      const res = await api(app)
        .post('/api/auth/login')
        .send({ email: 'old@example.test', password: PASSWORD })
        .expect(200);

      const stored = await dataSource.getRepository(User).findOneByOrFail({ id: user.id });
      expect(stored.passwordHash).not.toBe(weak);
      expect(parseOptions(stored.passwordHash!).timeCost).toBe(ARGON2_OPTIONS.timeCost);
      // The session is bound to the new hash, so it stays valid after the rehash.
      await api(app).get('/api/auth/me').set('Cookie', sessionCookieFrom(res)!).expect(200);
    });

    it('audits failed and successful logins', async () => {
      const user = await createUser(dataSource, { email: 'a@example.test', password: PASSWORD });
      await api(app)
        .post('/api/auth/login')
        .send({ email: 'a@example.test', password: 'wrong password!!' })
        .expect(401);
      await api(app)
        .post('/api/auth/login')
        .send({ email: 'ghost@example.test', password: 'wrong password!!' })
        .expect(401);
      await api(app)
        .post('/api/auth/login')
        .send({ email: 'a@example.test', password: PASSWORD })
        .expect(200);

      const events = await dataSource
        .getRepository(AuditEvent)
        .find({ order: { occurredAt: 'ASC' } });
      const failed = events.filter((e) => e.action === 'auth.login_failed');
      expect(failed).toHaveLength(2);
      expect(failed.find((e) => e.entityId === user.id)?.after).toEqual({
        email: 'a@example.test',
      });
      expect(failed.find((e) => e.entityId === null)?.after).toEqual({
        email: 'ghost@example.test',
      });
      const succeeded = events.find((e) => e.action === 'auth.login_succeeded');
      expect(succeeded).toMatchObject({
        actorUserId: user.id,
        entityType: 'user',
        entityId: user.id,
      });
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns the current user with a session cookie', async () => {
      const user = await createUser(dataSource, { email: 'a@example.test', password: PASSWORD });
      const { agent } = await signIn(app, 'a@example.test', PASSWORD);
      const res = await agent.get('/api/auth/me').expect(200);
      expect(res.body).toMatchObject({ id: user.id, email: 'a@example.test' });
    });

    it('returns 401 without a cookie', async () => {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });

    it('returns 401 and clears a tampered cookie', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', 'offwise_session=s%3Aforged.signature')
        .expect(401);
      expect(setCookies(res).some((c) => /^offwise_session=;/.test(c))).toBe(true);
    });

    it('returns 401 and clears an unsigned cookie', async () => {
      await createUser(dataSource, { email: 'a@example.test', password: PASSWORD });
      const { cookie } = await signIn(app, 'a@example.test', PASSWORD);
      const signed = decodeURIComponent(cookie.split('=')[1]!);
      const unsigned = signed.slice(2, signed.lastIndexOf('.'));
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', `offwise_session=${unsigned}`)
        .expect(401);
      expect(setCookies(res).some((c) => /^offwise_session=;/.test(c))).toBe(true);
    });

    it('returns 401 and clears the cookie when the session is gone from Redis', async () => {
      await createUser(dataSource, { email: 'a@example.test', password: PASSWORD });
      const { cookie } = await signIn(app, 'a@example.test', PASSWORD);
      await flushTestRedis();
      const res = await api(app).get('/api/auth/me').set('Cookie', cookie).expect(401);
      expect(setCookies(res).some((c) => /^offwise_session=;/.test(c))).toBe(true);
    });

    it('returns 401 and clears the cookie after logout', async () => {
      await createUser(dataSource, { email: 'a@example.test', password: PASSWORD });
      const { agent, cookie } = await signIn(app, 'a@example.test', PASSWORD);
      await agent.post('/api/auth/logout').expect(204);
      const res = await api(app).get('/api/auth/me').set('Cookie', cookie).expect(401);
      expect(setCookies(res).some((c) => /^offwise_session=;/.test(c))).toBe(true);
    });

    it('rejects a session created by a login that raced a password reset', async () => {
      // The login verified the old password; the reset then commits the new hash and ends all
      // sessions before the login stores its session, so destroyAllForUser never sees it.
      const user = await createUser(dataSource, { email: 'a@example.test', password: PASSWORD });
      const sessions = app.get(SessionService);
      const create = sessions.create.bind(sessions);
      vi.spyOn(sessions, 'create').mockImplementation(async (userId, fingerprint) => {
        const newHash = await app.get(PasswordService).hash('a brand new password');
        await dataSource.getRepository(User).update({ id: user.id }, { passwordHash: newHash });
        await sessions.destroyAllForUser(user.id);
        return create(userId, fingerprint);
      });
      const res = await api(app)
        .post('/api/auth/login')
        .send({ email: 'a@example.test', password: PASSWORD })
        .expect(200);
      vi.restoreAllMocks();
      const cookie = sessionCookieFrom(res)!;
      const me = await api(app).get('/api/auth/me').set('Cookie', cookie).expect(401);
      expect(setCookies(me).some((c) => /^offwise_session=;/.test(c))).toBe(true);
      const redis = app.get<Redis>(REDIS);
      expect(await redis.keys('session:*')).toEqual([]);
    });

    it('returns 401 once the password changed after sign-in', async () => {
      const user = await createUser(dataSource, { email: 'a@example.test', password: PASSWORD });
      const { agent } = await signIn(app, 'a@example.test', PASSWORD);
      const newHash = await app.get(PasswordService).hash('a brand new password');
      await dataSource.getRepository(User).update({ id: user.id }, { passwordHash: newHash });
      await agent.get('/api/auth/me').expect(401);
    });

    it('returns 401 for a session without a credential fingerprint', async () => {
      await createUser(dataSource, { email: 'a@example.test', password: PASSWORD });
      const { agent } = await signIn(app, 'a@example.test', PASSWORD);
      const redis = app.get<Redis>(REDIS);
      const [key] = await redis.keys('session:*');
      await redis.hdel(key!, 'credentialFingerprint');
      await agent.get('/api/auth/me').expect(401);
      expect(await redis.exists(key!)).toBe(0);
    });

    it('binds the session to the fingerprint of the current password hash', async () => {
      const user = await createUser(dataSource, { email: 'a@example.test', password: PASSWORD });
      await signIn(app, 'a@example.test', PASSWORD);
      const stored = await dataSource.getRepository(User).findOneByOrFail({ id: user.id });
      const redis = app.get<Redis>(REDIS);
      const [key] = await redis.keys('session:*');
      expect(await redis.hget(key!, 'credentialFingerprint')).toBe(hashToken(stored.passwordHash!));
    });

    it('returns 401 once the user is closed', async () => {
      const user = await createUser(dataSource, { email: 'a@example.test', password: PASSWORD });
      const { agent } = await signIn(app, 'a@example.test', PASSWORD);
      await dataSource.getRepository(User).softDelete(user.id);
      await agent.get('/api/auth/me').expect(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('ends the session, clears the cookie and audits', async () => {
      await createUser(dataSource, { email: 'a@example.test', password: PASSWORD });
      const { agent, cookie } = await signIn(app, 'a@example.test', PASSWORD);

      const res = await agent.post('/api/auth/logout').expect(204);
      const cleared = setCookies(res).find((c) => c.startsWith('offwise_session='));
      expect(cleared).toMatch(/^offwise_session=;/);
      expect(cleared).toContain('Path=/api');
      expect(cleared).toContain('HttpOnly');
      expect(cleared).toContain('Secure');
      expect(cleared).toContain('SameSite=Lax');
      expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);

      await api(app).set('Cookie', cookie).get('/api/auth/me').expect(401);
      expect(await auditActions()).toEqual(['auth.login_succeeded', 'auth.logout']);
    });

    it('returns 401 when not signed in', async () => {
      await api(app).post('/api/auth/logout').expect(401);
    });
  });

  describe('admin-only routes', () => {
    it('forbid an employee', async () => {
      await createUser(dataSource, { email: 'e@example.test', password: PASSWORD });
      const { agent } = await signIn(app, 'e@example.test', PASSWORD);
      await agent.get('/api/users').expect(403);
    });

    it('allow an admin', async () => {
      await createUser(dataSource, {
        email: 'adm@example.test',
        password: PASSWORD,
        role: 'admin',
      });
      const { agent } = await signIn(app, 'adm@example.test', PASSWORD);
      await agent.get('/api/users').expect(200);
    });

    it('require a session first', async () => {
      await request(app.getHttpServer()).get('/api/users').expect(401);
    });
  });
});
