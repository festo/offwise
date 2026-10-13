import type { DataSource } from 'typeorm';

/** Names of known migrations not yet recorded in the migrations table. Read-only: never migrates. */
export async function findPendingMigrations(dataSource: DataSource): Promise<string[]> {
  const known = dataSource.migrations.map(
    (migration) => migration.name ?? migration.constructor.name,
  );
  const table = dataSource.options.migrationsTableName ?? 'migrations';
  const queryRunner = dataSource.createQueryRunner();
  try {
    if (!(await queryRunner.hasTable(table))) {
      return known;
    }
    const rows: { name: string }[] = await queryRunner.query(`SELECT "name" FROM "${table}"`);
    const executed = new Set(rows.map((row) => row.name));
    return known.filter((name) => !executed.has(name));
  } finally {
    await queryRunner.release();
  }
}
