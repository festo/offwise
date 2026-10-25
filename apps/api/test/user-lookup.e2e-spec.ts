import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildDataSourceOptions } from '../src/database/typeorm-options';
import { User } from '../src/modules/users/entities/user.entity';
import { UserLookupService } from '../src/modules/users/user-lookup.service';
import { TEST_DATABASE_URL } from './test-env';
import { resetDatabase } from './utils/reset-database';

describe('UserLookupService (e2e)', () => {
  let dataSource: DataSource;
  let lookup: UserLookupService;

  const insertUser = (email: string): Promise<User> =>
    dataSource.getRepository(User).save({ email, name: 'Test' });

  const close = (user: User): Promise<unknown> =>
    dataSource.getRepository(User).softDelete({ id: user.id });

  beforeAll(async () => {
    dataSource = await new DataSource(buildDataSourceOptions(TEST_DATABASE_URL)).initialize();
    lookup = new UserLookupService(dataSource);
  });

  beforeEach(async () => {
    await resetDatabase(dataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  describe('findActiveById', () => {
    it('returns an active user', async () => {
      const user = await insertUser('a@x.io');
      await expect(lookup.findActiveById(user.id)).resolves.toMatchObject({ id: user.id });
    });

    it('returns null for a closed user', async () => {
      const user = await insertUser('a@x.io');
      await close(user);
      await expect(lookup.findActiveById(user.id)).resolves.toBeNull();
    });
  });

  describe('findActiveByEmail', () => {
    it('matches the email case-insensitively', async () => {
      const user = await insertUser('Anna@X.io');
      await expect(lookup.findActiveByEmail('anna@x.IO')).resolves.toMatchObject({ id: user.id });
    });

    it('returns null for a closed user', async () => {
      const user = await insertUser('a@x.io');
      await close(user);
      await expect(lookup.findActiveByEmail('a@x.io')).resolves.toBeNull();
    });

    it('returns null for an unknown email', async () => {
      await expect(lookup.findActiveByEmail('nobody@x.io')).resolves.toBeNull();
    });
  });

  it("reads through the caller's transaction when given its manager", async () => {
    await dataSource.transaction(async (manager) => {
      const user = await manager.getRepository(User).save({ email: 'tx@x.io', name: 'Test' });
      await expect(lookup.findActiveById(user.id, manager)).resolves.toMatchObject({
        id: user.id,
      });
      await expect(lookup.findActiveByEmail('tx@x.io', manager)).resolves.toMatchObject({
        id: user.id,
      });
    });
  });
});
