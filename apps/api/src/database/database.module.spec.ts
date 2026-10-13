import type { DataSource } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { DatabaseModule } from './database.module';

/** A DataSource stub: findPendingMigrations runs for real against these fakes. */
function moduleWith(known: string[], executed: string[], tableExists = true): DatabaseModule {
  const queryRunner = {
    hasTable: vi.fn().mockResolvedValue(tableExists),
    query: vi.fn().mockResolvedValue(executed.map((name) => ({ name }))),
    release: vi.fn().mockResolvedValue(undefined),
  };
  const dataSource = {
    migrations: known.map((name) => ({ name })),
    options: { migrationsTableName: 'migrations' },
    createQueryRunner: () => queryRunner,
  } as unknown as DataSource;
  return new DatabaseModule(dataSource);
}

describe('DatabaseModule.onModuleInit', () => {
  it('resolves when no migrations are pending', async () => {
    await expect(moduleWith(['A1', 'B2'], ['A1', 'B2']).onModuleInit()).resolves.toBeUndefined();
  });

  it('rejects, naming the pending migration and the command to run', async () => {
    const promise = moduleWith(['A1', 'B2'], ['A1']).onModuleInit();
    await expect(promise).rejects.toThrow(/B2/);
    await expect(promise).rejects.toThrow(/migration:run/);
  });
});
