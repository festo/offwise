import type { INestApplication, INestApplicationContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AuditEvent } from '../src/audit/audit-event.entity';
import { InstallCliModule } from '../src/install/install-cli.module';
import { InitialAdminService } from '../src/install/initial-admin.service';
import { User } from '../src/modules/users/entities/user.entity';
import { TEST_PUBLIC_URL } from './test-env';
import { createTestApp } from './utils/create-test-app';
import { createUser } from './utils/factories';
import { api, signIn } from './utils/http';
import { flushTestRedis } from './utils/redis';
import { resetDatabase } from './utils/reset-database';
import { runApiCli } from './utils/run-api-cli';

const PASSWORD = 'correct horse battery';
const EMAIL = 'first.admin@example.test';

describe('InitialAdminService (e2e)', () => {
  let cli: INestApplicationContext;
  let app: INestApplication;
  let dataSource: DataSource;
  let service: InitialAdminService;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
    const moduleRef = await Test.createTestingModule({ imports: [InstallCliModule] }).compile();
    cli = await moduleRef.init();
    service = cli.get(InitialAdminService);
  });

  beforeEach(async () => {
    await resetDatabase(dataSource);
    await flushTestRedis();
  });

  afterAll(async () => {
    await cli.close();
    await app.close();
  });

  const run = (email?: string, password?: string) =>
    service.run({ email, password, publicUrl: TEST_PUBLIC_URL });
  const audits = () => dataSource.getRepository(AuditEvent).find({ order: { occurredAt: 'ASC' } });

  it('skips when no email is configured', async () => {
    await expect(run()).resolves.toEqual({ outcome: 'skipped-not-configured' });
    expect(await dataSource.getRepository(User).count()).toBe(0);
  });

  it('skips and changes nothing when an admin already exists', async () => {
    await createUser(dataSource, { role: 'admin' });
    const employee = await createUser(dataSource, { email: EMAIL });

    await expect(run(EMAIL, PASSWORD)).resolves.toEqual({ outcome: 'skipped-admin-exists' });

    const after = await dataSource.getRepository(User).findOneByOrFail({ id: employee.id });
    expect(after.role).toBe('employee');
    expect(await audits()).toEqual([]);
  });

  it('promotes an existing employee with that email', async () => {
    const employee = await createUser(dataSource, { email: 'First.Admin@Example.test' });

    const result = await run(EMAIL, PASSWORD);

    // The existing (empty) password is kept: the configured one is ignored when promoting.
    expect(result.outcome).toBe('promoted');
    const after = await dataSource.getRepository(User).findOneByOrFail({ id: employee.id });
    expect(after.role).toBe('admin');
    expect(after.passwordHash).toBeNull();
    expect(result.resetLink).toMatch(/\/reset-password#token=[A-Za-z0-9_-]{43}$/);
    const token = result.resetLink!.split('#token=')[1];
    await api(app)
      .post('/api/auth/password-reset/confirm')
      .send({ token, password: PASSWORD })
      .expect(204);
    await signIn(app, EMAIL, PASSWORD);
    const [event] = await audits();
    expect(event).toMatchObject({
      action: 'user.role_changed',
      actorUserId: null,
      entityId: employee.id,
      before: { role: 'employee' },
      after: { role: 'admin' },
    });
  });

  it('promotes an existing user who has a password without a reset link', async () => {
    const employee = await createUser(dataSource, { email: EMAIL, password: PASSWORD });

    await expect(run(EMAIL, 'another password 123')).resolves.toEqual({ outcome: 'promoted' });

    await signIn(app, EMAIL, PASSWORD);
    expect(employee.id).toBeTruthy();
  });

  it('creates an admin with a password who can sign in', async () => {
    await expect(run(EMAIL, PASSWORD)).resolves.toEqual({ outcome: 'created-with-password' });

    const { agent } = await signIn(app, EMAIL, PASSWORD);
    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body).toMatchObject({ email: EMAIL, role: 'admin' });
    const [event] = await audits();
    expect(event).toMatchObject({ action: 'user.created', actorUserId: null });
    expect(JSON.stringify(event.after)).not.toContain(PASSWORD);
  });

  it('creates an admin without a password and returns a working reset link', async () => {
    const result = await run(EMAIL);

    expect(result.outcome).toBe('created-with-link');
    expect(result.resetLink).toMatch(
      new RegExp(`^${TEST_PUBLIC_URL}/reset-password#token=[A-Za-z0-9_-]{43}$`),
    );
    const token = result.resetLink!.split('#token=')[1];
    await api(app)
      .post('/api/auth/password-reset/confirm')
      .send({ token, password: PASSWORD })
      .expect(204);
    await signIn(app, EMAIL, PASSWORD);
  });
});

describe('install command: initial admin', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
    await resetDatabase(dataSource);
    await flushTestRedis();
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates the admin from the environment once, then skips', async () => {
    const env = { INITIAL_ADMIN_EMAIL: EMAIL, INITIAL_ADMIN_PASSWORD: PASSWORD };
    const first = runApiCli('ts-node', ['src/install.ts'], { env });
    expect(first.status, first.stderr).toBe(0);
    expect(first.stdout).toContain('Initial admin: created-with-password');

    const second = runApiCli('ts-node', ['src/install.ts'], { env });
    expect(second.status, second.stderr).toBe(0);
    expect(second.stdout).toContain('Initial admin: skipped-admin-exists');
  }, 60_000);

  it('prints the reset link when no password is configured', async () => {
    await resetDatabase(dataSource);
    const run = runApiCli('ts-node', ['src/install.ts'], {
      env: { INITIAL_ADMIN_EMAIL: EMAIL },
    });
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toContain('Initial admin: created-with-link');
    expect(run.stdout).toMatch(
      /Set the initial admin password within 24 hours: http\S+\/reset-password#token=\S+/,
    );
  }, 60_000);

  it('prints the reset link when promoting a user without a password', async () => {
    await resetDatabase(dataSource);
    await createUser(dataSource, { email: EMAIL });
    const run = runApiCli('ts-node', ['src/install.ts'], { env: { INITIAL_ADMIN_EMAIL: EMAIL } });
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toContain('Initial admin: promoted');
    expect(run.stdout).toMatch(/Set the initial admin password within 24 hours: http\S+#token=\S+/);
  }, 60_000);

  it('fails with a message naming a too-short INITIAL_ADMIN_PASSWORD', () => {
    const run = runApiCli('ts-node', ['src/install.ts'], {
      env: { INITIAL_ADMIN_EMAIL: EMAIL, INITIAL_ADMIN_PASSWORD: '12345678' },
    });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain('INITIAL_ADMIN_PASSWORD');
  }, 60_000);
});
