import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditEvent } from '../src/audit/audit-event.entity';
import { AuditService } from '../src/audit/audit.service';
import { ResetTokenService } from '../src/modules/auth/reset-token.service';
import { SessionService } from '../src/modules/auth/session.service';
import { ThrottleService } from '../src/modules/auth/throttle.service';
import { User } from '../src/modules/users/entities/user.entity';
import { createTestApp } from './utils/create-test-app';
import { createUser } from './utils/factories';
import { api, signIn } from './utils/http';
import {
  clearMailbox,
  extractResetToken,
  messageCountTo,
  waitForMessagesTo,
} from './utils/mailpit';
import { flushTestRedis } from './utils/redis';
import { resetDatabase } from './utils/reset-database';

const OLD_PASSWORD = 'old password 123';
const NEW_PASSWORD = 'brand new password';

describe('Password reset (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    await clearMailbox();
    await resetDatabase(dataSource);
    await flushTestRedis();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  const requestReset = (email: string) => api(app).post('/api/auth/password-reset').send({ email });

  /**
   * Waits until the background jobs of `count` reset requests have finished: the emails arrived and
   * the requests were audited (the audit is written after the send). Call it before a test ends,
   * so no in-flight job writes into the next test's database or mailbox.
   */
  async function waitForResets(email: string, count: number) {
    const mails = await waitForMessagesTo(email, count);
    const deadline = Date.now() + 5000;
    while (
      (await dataSource
        .getRepository(AuditEvent)
        .countBy({ action: 'auth.password_reset_requested' })) < count
    ) {
      if (Date.now() >= deadline) throw new Error(`Fewer than ${count} reset requests audited`);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return mails;
  }

  async function tokenFor(email: string): Promise<string> {
    expect((await requestReset(email)).status).toBe(202);
    const [mail] = await waitForResets(email, 1);
    return extractResetToken(mail!.Text);
  }

  it('emails a reset link for an existing user', async () => {
    const user = await createUser(dataSource, { password: OLD_PASSWORD });
    const res = await requestReset(user.email);
    expect(res.status).toBe(202);
    const [mail] = await waitForResets(user.email, 1);
    expect(mail!.Subject).toBe('Reset your offwise password');
    expect(mail!.Text).toContain('http://localhost:5173/reset-password#token=');
    expect(mail!.HTML).toContain('http://localhost:5173/reset-password#token=');
  });

  it('confirms the reset, ends old sessions and rejects token reuse', async () => {
    const user = await createUser(dataSource, { password: OLD_PASSWORD });
    const { agent } = await signIn(app, user.email, OLD_PASSWORD);
    expect((await agent.get('/api/auth/me')).status).toBe(200);

    const token = await tokenFor(user.email);
    const confirm = await api(app)
      .post('/api/auth/password-reset/confirm')
      .send({ token, password: NEW_PASSWORD });
    expect(confirm.status).toBe(204);

    const login = await api(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: NEW_PASSWORD });
    expect(login.status).toBe(200);
    expect((await agent.get('/api/auth/me')).status).toBe(401);

    const again = await api(app)
      .post('/api/auth/password-reset/confirm')
      .send({ token, password: NEW_PASSWORD });
    expect(again.status).toBe(400);
  });

  it('invalidates the other outstanding reset tokens after a successful confirm', async () => {
    const user = await createUser(dataSource, { password: OLD_PASSWORD });
    expect((await requestReset(user.email)).status).toBe(202);
    expect((await requestReset(user.email)).status).toBe(202);
    const [first, second] = (await waitForResets(user.email, 2)).map((m) =>
      extractResetToken(m.Text),
    );
    expect(first).not.toBe(second);

    await api(app)
      .post('/api/auth/password-reset/confirm')
      .send({ token: first, password: NEW_PASSWORD })
      .expect(204);
    const res = await api(app)
      .post('/api/auth/password-reset/confirm')
      .send({ token: second, password: 'another new password' })
      .expect(400);
    expect(res.body.message).toBe('This reset link is invalid or has expired.');
  });

  it('rejects a too short password and keeps the token usable', async () => {
    const user = await createUser(dataSource, { password: OLD_PASSWORD });
    const token = await tokenFor(user.email);
    const short = await api(app)
      .post('/api/auth/password-reset/confirm')
      .send({ token, password: 'short' });
    expect(short.status).toBe(400);
    const ok = await api(app)
      .post('/api/auth/password-reset/confirm')
      .send({ token, password: NEW_PASSWORD });
    expect(ok.status).toBe(204);
  });

  it('rejects an unknown token', async () => {
    const res = await api(app)
      .post('/api/auth/password-reset/confirm')
      .send({ token: 'nope', password: NEW_PASSWORD });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('This reset link is invalid or has expired.');
  });

  it('answers 202 for an unknown email and sends nothing', async () => {
    const res = await requestReset('nobody@example.test');
    expect(res.status).toBe(202);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(await messageCountTo('nobody@example.test')).toBe(0);
    expect(await dataSource.getRepository(AuditEvent).count()).toBe(0);
  });

  it('does not send for a closed user', async () => {
    const user = await createUser(dataSource, { deletedAt: new Date() });
    expect((await requestReset(user.email)).status).toBe(202);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(await messageCountTo(user.email)).toBe(0);
  });

  it('throttles the 4th request within the hour', async () => {
    const user = await createUser(dataSource, { password: OLD_PASSWORD });
    for (let i = 0; i < 3; i++) expect((await requestReset(user.email)).status).toBe(202);
    const res = await requestReset(user.email);
    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
    await waitForResets(user.email, 3);
  });

  it('throttles a single IP after 20 requests within the hour, across emails', async () => {
    for (let i = 0; i < 20; i++) {
      expect((await requestReset(`nobody-${i}@example.test`)).status, `request ${i + 1}`).toBe(202);
    }
    const res = await requestReset('nobody-20@example.test');
    expect(res.status).toBe(429);
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    // Let the background lookups for the unknown emails finish before the next test.
    await new Promise((resolve) => setTimeout(resolve, 200));
  });

  it('audits the request and the completion', async () => {
    const user = await createUser(dataSource, { password: OLD_PASSWORD });
    const token = await tokenFor(user.email);
    await api(app)
      .post('/api/auth/password-reset/confirm')
      .send({ token, password: NEW_PASSWORD })
      .expect(204);
    const actions = (await dataSource.getRepository(AuditEvent).find()).map((e) => e.action);
    expect(actions).toContain('auth.password_reset_requested');
    expect(actions).toContain('auth.password_reset_completed');
  });

  it.each([
    ['revoking the reset tokens', () => vi.spyOn(app.get(ResetTokenService), 'revokeAllForUser')],
    ['ending the sessions', () => vi.spyOn(app.get(SessionService), 'destroyAllForUser')],
    ['clearing the login throttle', () => vi.spyOn(app.get(ThrottleService), 'clear')],
  ])('commits the new password even when %s fails', async (_, spy) => {
    const user = await createUser(dataSource, { password: OLD_PASSWORD });
    const { agent } = await signIn(app, user.email, OLD_PASSWORD);
    const token = await tokenFor(user.email);
    spy().mockRejectedValueOnce(new Error('redis down'));

    await api(app)
      .post('/api/auth/password-reset/confirm')
      .send({ token, password: NEW_PASSWORD })
      .expect(204);

    const actions = (await dataSource.getRepository(AuditEvent).find()).map((e) => e.action);
    expect(actions).toContain('auth.password_reset_completed');
    await agent.get('/api/auth/me').expect(401);
    await api(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: NEW_PASSWORD })
      .expect(200);
  });

  it('keeps the old password and leaves Redis alone when the transaction fails', async () => {
    const user = await createUser(dataSource, { password: OLD_PASSWORD });
    const before = (await dataSource.getRepository(User).findOneByOrFail({ id: user.id }))
      .passwordHash;
    const token = await tokenFor(user.email);
    vi.spyOn(app.get(AuditService), 'record').mockRejectedValueOnce(new Error('db down'));
    const revoke = vi.spyOn(app.get(ResetTokenService), 'revokeAllForUser');
    const destroy = vi.spyOn(app.get(SessionService), 'destroyAllForUser');
    const clear = vi.spyOn(app.get(ThrottleService), 'clear');

    await api(app)
      .post('/api/auth/password-reset/confirm')
      .send({ token, password: NEW_PASSWORD })
      .expect(500);

    const after = await dataSource.getRepository(User).findOneByOrFail({ id: user.id });
    expect(after.passwordHash).toBe(before);
    expect(revoke).not.toHaveBeenCalled();
    expect(destroy).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
  });

  it('clears the login throttle for the email after a successful reset', async () => {
    const user = await createUser(dataSource, { password: OLD_PASSWORD });
    for (let i = 0; i < 5; i++) {
      await api(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: 'wrong password!!' })
        .expect(401);
    }
    await api(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: OLD_PASSWORD })
      .expect(429);

    const token = await tokenFor(user.email);
    await api(app)
      .post('/api/auth/password-reset/confirm')
      .send({ token, password: NEW_PASSWORD })
      .expect(204);
    await api(app)
      .post('/api/auth/login')
      .send({ email: user.email.toUpperCase(), password: NEW_PASSWORD })
      .expect(200);
  });
});
