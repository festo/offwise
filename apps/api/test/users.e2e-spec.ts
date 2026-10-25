import type { INestApplication } from '@nestjs/common';
import type { Page, UserDto } from '@offwise/shared';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AuditAction } from '../src/audit/audit-actions';
import { AuditEvent } from '../src/audit/audit-event.entity';
import { ResetTokenService } from '../src/modules/auth/reset-token.service';
import { User } from '../src/modules/users/entities/user.entity';
import { createTestApp } from './utils/create-test-app';
import { createUser } from './utils/factories';
import { api, signIn } from './utils/http';
import { flushTestRedis } from './utils/redis';
import { resetDatabase } from './utils/reset-database';

const PASSWORD = 'correct horse battery';
const ADMIN_EMAIL = 'admin@example.test';
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

describe('Users (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let admin: User;
  let agent: request.Agent;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    await resetDatabase(dataSource);
    await flushTestRedis();
    admin = await createUser(dataSource, {
      name: 'Admin',
      email: ADMIN_EMAIL,
      role: 'admin',
      password: PASSWORD,
    });
    ({ agent } = await signIn(app, ADMIN_EMAIL, PASSWORD));
  });

  afterAll(async () => {
    await app.close();
  });

  const closeDirectly = (id: string) => dataSource.getRepository(User).softDelete(id);

  const auditEvents = async (action: AuditAction) =>
    dataSource.getRepository(AuditEvent).find({ where: { action }, order: { occurredAt: 'ASC' } });

  describe('GET /api/users', () => {
    it('lists active users sorted by name', async () => {
      await createUser(dataSource, { name: 'Charlie' });
      await createUser(dataSource, { name: 'bob' });
      const closed = await createUser(dataSource, { name: 'Alice' });
      await closeDirectly(closed.id);

      const res = await agent.get('/api/users').expect(200);
      const body = res.body as Page<UserDto>;
      expect(body.items.map((u) => u.name)).toEqual(['Admin', 'bob', 'Charlie']);
      expect(body).toMatchObject({ total: 3, page: 1, pageSize: 25 });
      expect(body.items[0]).toEqual({
        id: admin.id,
        name: 'Admin',
        email: ADMIN_EMAIL,
        role: 'admin',
        locale: null,
        timeZone: null,
        hasPassword: true,
        createdAt: admin.createdAt.toISOString(),
        closedAt: null,
      } satisfies UserDto);
      expect(body.items[0]).not.toHaveProperty('passwordHash');
    });

    it('includes closed users with includeClosed=true', async () => {
      const closed = await createUser(dataSource, { name: 'Alice' });
      await closeDirectly(closed.id);
      const res = await agent.get('/api/users?includeClosed=true').expect(200);
      const body = res.body as Page<UserDto>;
      expect(body.items.map((u) => u.name)).toEqual(['Admin', 'Alice']);
      expect(body.items[1]!.closedAt).not.toBeNull();
    });

    it('treats includeClosed=false as false', async () => {
      const closed = await createUser(dataSource, { name: 'Alice' });
      await closeDirectly(closed.id);
      const res = await agent.get('/api/users?includeClosed=false').expect(200);
      expect((res.body as Page<UserDto>).total).toBe(1);
    });

    it('searches name and email case-insensitively', async () => {
      await createUser(dataSource, { name: 'Grace Hopper', email: 'grace@navy.test' });
      await createUser(dataSource, { name: 'Ada', email: 'ADA@HOPPER.test' });
      await createUser(dataSource, { name: 'Linus', email: 'linus@example.test' });

      const res = await agent.get('/api/users?search=hOpPeR').expect(200);
      expect((res.body as Page<UserDto>).items.map((u) => u.name)).toEqual(['Ada', 'Grace Hopper']);
    });

    it('treats LIKE wildcards in search literally', async () => {
      await createUser(dataSource, { name: '100% Real' });
      await createUser(dataSource, { name: 'a_b' });
      await createUser(dataSource, { name: 'back\\slash' });
      await createUser(dataSource, { name: 'Plain' });

      const pct = await agent.get(`/api/users?search=${encodeURIComponent('%')}`).expect(200);
      expect((pct.body as Page<UserDto>).items.map((u) => u.name)).toEqual(['100% Real']);
      const under = await agent.get('/api/users?search=_').expect(200);
      expect((under.body as Page<UserDto>).items.map((u) => u.name)).toEqual(['a_b']);
      const bs = await agent.get(`/api/users?search=${encodeURIComponent('\\')}`).expect(200);
      expect((bs.body as Page<UserDto>).items.map((u) => u.name)).toEqual(['back\\slash']);
    });

    it('paginates', async () => {
      for (const name of ['B', 'C', 'D', 'E']) await createUser(dataSource, { name });

      const first = (await agent.get('/api/users?pageSize=2').expect(200)).body as Page<UserDto>;
      expect(first.items.map((u) => u.name)).toEqual(['Admin', 'B']);
      expect(first).toMatchObject({ total: 5, page: 1, pageSize: 2 });

      const third = (await agent.get('/api/users?pageSize=2&page=3').expect(200))
        .body as Page<UserDto>;
      expect(third.items.map((u) => u.name)).toEqual(['E']);
      expect(third).toMatchObject({ total: 5, page: 3, pageSize: 2 });
    });

    it.each([
      'pageSize=101',
      'pageSize=0',
      'page=0',
      'page=abc',
      'page=1e300',
      'page=1000001',
      'includeClosed=maybe',
      'x=1',
    ])('rejects %s with 400', async (query) => {
      await agent.get(`/api/users?${query}`).expect(400);
    });
  });

  describe('POST /api/users', () => {
    it('creates a user without a password', async () => {
      const res = await agent
        .post('/api/users')
        .send({
          name: '  Grace Hopper  ',
          email: 'Grace@Example.test',
          role: 'manager',
          locale: 'en-gb',
          timeZone: 'Europe/Budapest',
        })
        .expect(201);
      const body = res.body as UserDto;
      expect(body).toMatchObject({
        name: 'Grace Hopper',
        email: 'Grace@Example.test',
        role: 'manager',
        locale: 'en-GB',
        timeZone: 'Europe/Budapest',
        hasPassword: false,
        closedAt: null,
      });
      const stored = await dataSource.getRepository(User).findOneByOrFail({ id: body.id });
      expect(stored.locale).toBe('en-GB');
      expect(stored.passwordHash).toBeNull();
    });

    it('defaults locale and time zone to null', async () => {
      const res = await agent
        .post('/api/users')
        .send({ name: 'N', email: 'n@example.test', role: 'employee' })
        .expect(201);
      expect(res.body).toMatchObject({ locale: null, timeZone: null });
    });

    it.each([
      { timeZone: 'Mars/Base' },
      { locale: 'en_GB' },
      { role: 'superuser' },
      { email: 'not-an-email' },
      { name: '   ' },
      { name: 'x'.repeat(201) },
      { unknown: 'property' },
    ])('rejects %j with 400', async (patch) => {
      await agent
        .post('/api/users')
        .send({ name: 'N', email: 'n@example.test', role: 'employee', ...patch })
        .expect(400);
    });

    it('returns 409 for an email an active user has, in another case', async () => {
      await createUser(dataSource, { email: 'taken@example.test' });
      const res = await agent
        .post('/api/users')
        .send({ name: 'N', email: 'TAKEN@example.test', role: 'employee' })
        .expect(409);
      expect(res.body).toEqual({
        statusCode: 409,
        message: 'A user with this email already exists.',
        field: 'email',
      });
    });

    it('returns 409 when a concurrent insert wins the unique index', async () => {
      const holder = dataSource.createQueryRunner();
      await holder.connect();
      await holder.startTransaction();
      try {
        // Uncommitted, so the API's duplicate check misses it and its insert waits on the index.
        await holder.query(
          `INSERT INTO users (name, email, role) VALUES ('Racer', 'race@example.test', 'employee')`,
        );
        const pending = agent
          .post('/api/users')
          .send({ name: 'N', email: 'RACE@example.test', role: 'employee' })
          .then((res) => res);
        await new Promise((resolve) => setTimeout(resolve, 300));
        await holder.commitTransaction();
        const res = await pending;
        expect(res.status).toBe(409);
        expect(res.body).toMatchObject({ field: 'email' });
      } finally {
        if (holder.isTransactionActive) await holder.rollbackTransaction();
        await holder.release();
      }
    });

    it("allows a closed user's email", async () => {
      const closed = await createUser(dataSource, { email: 'old@example.test' });
      await agent.delete(`/api/users/${closed.id}`).expect(204);
      await agent
        .post('/api/users')
        .send({ name: 'N', email: 'old@example.test', role: 'employee' })
        .expect(201);
    });
  });

  describe('GET /api/users/:id', () => {
    it('returns a user', async () => {
      const user = await createUser(dataSource, { name: 'U' });
      const res = await agent.get(`/api/users/${user.id}`).expect(200);
      expect(res.body).toMatchObject({ id: user.id, name: 'U', hasPassword: false });
    });

    it('returns a closed user with closedAt', async () => {
      const user = await createUser(dataSource);
      await closeDirectly(user.id);
      const res = await agent.get(`/api/users/${user.id}`).expect(200);
      expect(typeof (res.body as UserDto).closedAt).toBe('string');
    });

    it('returns 404 for an unknown id and 400 for a non-uuid', async () => {
      await agent.get(`/api/users/${UNKNOWN_ID}`).expect(404);
      await agent.get('/api/users/not-a-uuid').expect(400);
    });
  });

  describe('PATCH /api/users/:id', () => {
    it('updates name and role', async () => {
      const user = await createUser(dataSource, { name: 'Old' });
      const res = await agent
        .patch(`/api/users/${user.id}`)
        .send({ name: 'New', role: 'manager' })
        .expect(200);
      expect(res.body).toMatchObject({ id: user.id, name: 'New', role: 'manager' });
    });

    it('clears locale and time zone with null', async () => {
      const user = await createUser(dataSource, { locale: 'hu-HU', timeZone: 'Europe/Budapest' });
      const res = await agent
        .patch(`/api/users/${user.id}`)
        .send({ locale: null, timeZone: null })
        .expect(200);
      expect(res.body).toMatchObject({ locale: null, timeZone: null });
    });

    it.each([{ name: null }, { email: null }, { role: null }, { timeZone: 'nope' }, { x: 1 }])(
      'rejects %j with 400',
      async (body) => {
        const user = await createUser(dataSource);
        await agent.patch(`/api/users/${user.id}`).send(body).expect(400);
      },
    );

    it("allows a closed user's email", async () => {
      const closed = await createUser(dataSource, { email: 'old@example.test' });
      await closeDirectly(closed.id);
      const user = await createUser(dataSource);
      await agent.patch(`/api/users/${user.id}`).send({ email: 'OLD@example.test' }).expect(200);
    });

    it("returns 409 for an active user's email", async () => {
      await createUser(dataSource, { email: 'taken@example.test' });
      const user = await createUser(dataSource);
      const res = await agent
        .patch(`/api/users/${user.id}`)
        .send({ email: 'Taken@example.test' })
        .expect(409);
      expect(res.body).toMatchObject({ statusCode: 409, field: 'email' });
    });

    it("revokes the user's outstanding reset links when the email changes", async () => {
      const user = await createUser(dataSource, { email: 'before@example.test' });
      const tokens = app.get(ResetTokenService);
      const first = await tokens.create(user.id);
      const second = await tokens.create(user.id);
      await agent.patch(`/api/users/${user.id}`).send({ email: 'after@example.test' }).expect(200);
      expect(await tokens.consume(first)).toBeNull();
      expect(await tokens.consume(second)).toBeNull();
    });

    it('keeps reset links when the email does not change', async () => {
      const user = await createUser(dataSource, { email: 'same@example.test' });
      const tokens = app.get(ResetTokenService);
      const token = await tokens.create(user.id);
      await agent
        .patch(`/api/users/${user.id}`)
        .send({ name: 'Renamed', email: 'same@example.test' })
        .expect(200);
      expect(await tokens.consume(token)).toBe(user.id);
    });

    it('allows changing the case of the own email', async () => {
      const user = await createUser(dataSource, { email: 'me@example.test' });
      await agent.patch(`/api/users/${user.id}`).send({ email: 'Me@Example.test' }).expect(200);
    });

    it('returns 409 when demoting the only admin (self)', async () => {
      const res = await agent
        .patch(`/api/users/${admin.id}`)
        .send({ role: 'employee' })
        .expect(409);
      expect(res.body).toEqual({
        statusCode: 409,
        message: 'The last active admin cannot be closed or lose the admin role.',
        rule: 'last-admin',
      });
      const stored = await dataSource.getRepository(User).findOneByOrFail({ id: admin.id });
      expect(stored.role).toBe('admin');
    });

    it('does not count a closed admin as active', async () => {
      const closedAdmin = await createUser(dataSource, { role: 'admin' });
      await closeDirectly(closedAdmin.id);
      await agent.patch(`/api/users/${admin.id}`).send({ role: 'employee' }).expect(409);
    });

    it('demotes one of two admins', async () => {
      const other = await createUser(dataSource, { role: 'admin' });
      await agent.patch(`/api/users/${other.id}`).send({ role: 'employee' }).expect(200);
    });

    it('lets only one of two concurrent demotions through', async () => {
      const other = await createUser(dataSource, { role: 'admin' });
      const results = await Promise.all([
        agent.patch(`/api/users/${admin.id}`).send({ role: 'employee' }),
        agent.patch(`/api/users/${other.id}`).send({ role: 'employee' }),
      ]);
      // The admin agent may lose its rights if its own demotion wins, so the other request
      // either conflicts (409) or is forbidden (403); exactly one succeeds.
      expect(results.filter((r) => r.status === 200)).toHaveLength(1);
      const admins = await dataSource.getRepository(User).countBy({ role: 'admin' });
      expect(admins).toBe(1);
    });

    it.each([
      ['PATCH', (id: string) => agent.patch(`/api/users/${id}`).send({ role: 'employee' }), 200],
      ['DELETE', (id: string) => agent.delete(`/api/users/${id}`), 204],
    ] as const)('%s waits for the last-admin lock', async (_method, send, status) => {
      const other = await createUser(dataSource, { role: 'admin' });
      const holder = dataSource.createQueryRunner();
      await holder.connect();
      await holder.startTransaction();
      try {
        await holder.query('SELECT pg_advisory_xact_lock(4242002)');
        let settled = false;
        const pending = send(other.id).then((res) => {
          settled = true;
          return res;
        });
        await new Promise((resolve) => setTimeout(resolve, 300));
        expect(settled).toBe(false);
        await holder.commitTransaction();
        expect((await pending).status).toBe(status);
      } finally {
        if (holder.isTransactionActive) await holder.rollbackTransaction();
        await holder.release();
      }
    });

    it('edits a closed user', async () => {
      const user = await createUser(dataSource, { name: 'Old' });
      await closeDirectly(user.id);
      const res = await agent.patch(`/api/users/${user.id}`).send({ name: 'New' }).expect(200);
      expect(res.body).toMatchObject({ name: 'New' });
      expect((res.body as UserDto).closedAt).not.toBeNull();
    });

    it('returns 404 for an unknown id', async () => {
      await agent.patch(`/api/users/${UNKNOWN_ID}`).send({ name: 'X' }).expect(404);
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('closes the user and ends their sessions', async () => {
      const user = await createUser(dataSource, { email: 'u@example.test', password: PASSWORD });
      const { agent: userAgent } = await signIn(app, 'u@example.test', PASSWORD);
      await userAgent.get('/api/auth/me').expect(200);

      await agent.delete(`/api/users/${user.id}`).expect(204);

      await userAgent.get('/api/auth/me').expect(401);
      const stored = await dataSource
        .getRepository(User)
        .findOneOrFail({ where: { id: user.id }, withDeleted: true });
      expect(stored.deletedAt).toBeInstanceOf(Date);
    });

    it('returns 404 when already closed or unknown', async () => {
      const user = await createUser(dataSource);
      await agent.delete(`/api/users/${user.id}`).expect(204);
      await agent.delete(`/api/users/${user.id}`).expect(404);
      await agent.delete(`/api/users/${UNKNOWN_ID}`).expect(404);
    });

    it('returns 409 when closing the last admin (self)', async () => {
      const res = await agent.delete(`/api/users/${admin.id}`).expect(409);
      expect(res.body).toMatchObject({ rule: 'last-admin' });
      await agent.get('/api/auth/me').expect(200);
    });

    it('closes one of two admins', async () => {
      const other = await createUser(dataSource, { role: 'admin' });
      await agent.delete(`/api/users/${other.id}`).expect(204);
    });
  });

  describe('audit', () => {
    it('records create, update, role change and close with the admin as actor', async () => {
      const created = (
        await agent
          .post('/api/users')
          .send({ name: 'Grace', email: 'grace@example.test', role: 'employee' })
          .expect(201)
      ).body as UserDto;
      await agent
        .patch(`/api/users/${created.id}`)
        .send({ name: 'Grace Hopper', email: 'grace@example.test', role: 'manager' })
        .expect(200);
      await agent.delete(`/api/users/${created.id}`).expect(204);

      const [createdEvent] = await auditEvents('user.created');
      expect(createdEvent).toMatchObject({
        actorUserId: admin.id,
        entityType: 'user',
        entityId: created.id,
        after: {
          name: 'Grace',
          email: 'grace@example.test',
          role: 'employee',
          locale: null,
          timeZone: null,
        },
      });

      const updated = await auditEvents('user.updated');
      expect(updated).toHaveLength(1);
      expect(updated[0]).toMatchObject({
        actorUserId: admin.id,
        entityId: created.id,
        before: { name: 'Grace' },
        after: { name: 'Grace Hopper' },
      });

      const roleChanged = await auditEvents('user.role_changed');
      expect(roleChanged).toHaveLength(1);
      expect(roleChanged[0]).toMatchObject({
        actorUserId: admin.id,
        entityId: created.id,
        before: { role: 'employee' },
        after: { role: 'manager' },
      });

      const closed = await auditEvents('user.closed');
      expect(closed).toHaveLength(1);
      expect(closed[0]).toMatchObject({ actorUserId: admin.id, entityId: created.id });
    });

    it('records only the changed fields when locale and time zone change', async () => {
      const user = await createUser(dataSource, {
        name: 'Same',
        locale: 'en-GB',
        timeZone: 'Europe/London',
      });
      await agent
        .patch(`/api/users/${user.id}`)
        .send({ name: 'Same', locale: 'hu-HU', timeZone: 'Europe/Budapest' })
        .expect(200);
      const updated = await auditEvents('user.updated');
      expect(updated).toHaveLength(1);
      expect(updated[0]).toMatchObject({
        entityId: user.id,
        before: { locale: 'en-GB', timeZone: 'Europe/London' },
        after: { locale: 'hu-HU', timeZone: 'Europe/Budapest' },
      });
      expect(Object.keys(updated[0]!.before as object).sort()).toEqual(['locale', 'timeZone']);
      expect(Object.keys(updated[0]!.after as object).sort()).toEqual(['locale', 'timeZone']);
    });

    it('records nothing for a PATCH that changes nothing', async () => {
      const user = await createUser(dataSource, { name: 'Same' });
      await agent.patch(`/api/users/${user.id}`).send({ name: 'Same' }).expect(200);
      expect(await auditEvents('user.updated')).toHaveLength(0);
      expect(await auditEvents('user.role_changed')).toHaveLength(0);
    });

    it('records nothing when a write is rejected', async () => {
      await agent.patch(`/api/users/${admin.id}`).send({ role: 'employee' }).expect(409);
      await agent.delete(`/api/users/${admin.id}`).expect(409);
      expect(await auditEvents('user.role_changed')).toHaveLength(0);
      expect(await auditEvents('user.closed')).toHaveLength(0);
    });
  });

  describe('access', () => {
    const routes = (id: string): [string, string, object?][] => [
      ['get', '/api/users'],
      ['get', `/api/users/${id}`],
      ['post', '/api/users', { name: 'N', email: 'n@example.test', role: 'employee' }],
      ['patch', `/api/users/${id}`, { name: 'N' }],
      ['delete', `/api/users/${id}`],
    ];

    it('forbids an employee on every endpoint', async () => {
      const employee = await createUser(dataSource, {
        email: 'e@example.test',
        password: PASSWORD,
      });
      const { agent: employeeAgent } = await signIn(app, 'e@example.test', PASSWORD);
      for (const [method, url, body] of routes(employee.id)) {
        const req = (employeeAgent as unknown as Record<string, (u: string) => request.Test>)[
          method
        ]!(url);
        await (body ? req.send(body) : req).expect(403);
      }
    });

    it('requires a session on every endpoint', async () => {
      for (const [method, url, body] of routes(admin.id)) {
        const req = (api(app) as unknown as Record<string, (u: string) => request.Test>)[method]!(
          url,
        );
        await (body ? req.send(body) : req).expect(401);
      }
    });
  });
});
