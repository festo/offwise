import type { DataSource } from 'typeorm';

/** Empties every entity table (not the migrations table). Call in beforeEach of suites that write. */
export async function resetDatabase(dataSource: DataSource): Promise<void> {
  const tables = dataSource.entityMetadatas.map((metadata) => `"${metadata.tableName}"`);
  if (tables.length === 0) return;
  await dataSource.query(`TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
}
