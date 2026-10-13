import 'reflect-metadata';
import { DataSource, type MigrationInterface } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { buildDataSourceOptions } from '../src/database/typeorm-options';
import { findPendingMigrations } from '../src/database/pending-migrations';
import { TEST_DATABASE_URL } from './test-env';

class NotYetApplied9999999999999 implements MigrationInterface {
  name = 'NotYetApplied9999999999999';
  async up(): Promise<void> {}
  async down(): Promise<void> {}
}

async function withDataSource<T>(
  extraMigrations: (new () => MigrationInterface)[],
  fn: (dataSource: DataSource) => Promise<T>,
): Promise<T> {
  const options = buildDataSourceOptions(TEST_DATABASE_URL);
  const known = (options.migrations ?? []) as (new () => MigrationInterface)[];
  const dataSource = new DataSource({ ...options, migrations: [...known, ...extraMigrations] });
  await dataSource.initialize();
  try {
    return await fn(dataSource);
  } finally {
    await dataSource.destroy();
  }
}

describe('findPendingMigrations (e2e)', () => {
  it('returns nothing for a fully migrated database', async () => {
    await expect(withDataSource([], findPendingMigrations)).resolves.toEqual([]);
  });

  it('returns migrations that have not been applied, without applying them', async () => {
    await withDataSource([NotYetApplied9999999999999], async (dataSource) => {
      await expect(findPendingMigrations(dataSource)).resolves.toEqual([
        'NotYetApplied9999999999999',
      ]);
      await expect(findPendingMigrations(dataSource)).resolves.toEqual([
        'NotYetApplied9999999999999',
      ]);
    });
  });
});
