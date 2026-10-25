import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildDataSourceOptions } from '../src/database/typeorm-options';
import { TEST_DATABASE_URL } from './test-env';
import { resetDatabase } from './utils/reset-database';

describe('identity schema (e2e)', () => {
  let dataSource: DataSource;

  const insertUser = (email: string): Promise<{ id: string }[]> =>
    dataSource.query(`INSERT INTO "users" ("email", "name") VALUES ($1, 'Test') RETURNING "id"`, [
      email,
    ]);

  const insertAuditEvent = (): Promise<unknown> =>
    dataSource.query(`INSERT INTO "audit_events" ("action") VALUES ('test.action')`);

  beforeAll(async () => {
    dataSource = await new DataSource(buildDataSourceOptions(TEST_DATABASE_URL)).initialize();
  });

  beforeEach(async () => {
    await resetDatabase(dataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  it('rejects a second active user whose email differs only in case', async () => {
    await insertUser('A@x.io');
    await expect(insertUser('a@x.io')).rejects.toMatchObject({
      driverError: { code: '23505', constraint: 'UQ_users_email_active' },
    });
  });

  it('allows reusing the email of a soft-deleted user', async () => {
    const [first] = await insertUser('A@x.io');
    await dataSource.query(`UPDATE "users" SET "deleted_at" = now() WHERE "id" = $1`, [first.id]);
    await expect(insertUser('a@x.io')).resolves.toHaveLength(1);
  });

  it('rejects UPDATE and DELETE on audit_events', async () => {
    await insertAuditEvent();
    await expect(dataSource.query(`UPDATE "audit_events" SET "action" = 'x'`)).rejects.toThrow(
      'audit_events is append-only',
    );
    await expect(dataSource.query(`DELETE FROM "audit_events"`)).rejects.toThrow(
      'audit_events is append-only',
    );
  });

  it('stores no client IP in audit_events', async () => {
    const columns: { column_name: string }[] = await dataSource.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'audit_events'`,
    );
    expect(columns.map((c) => c.column_name)).not.toContain('ip');
  });

  it('still allows TRUNCATE on audit_events', async () => {
    await insertAuditEvent();
    await dataSource.query(`TRUNCATE "audit_events"`);
    expect(await dataSource.query(`SELECT 1 FROM "audit_events"`)).toEqual([]);
  });
});
