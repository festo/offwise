import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildDataSourceOptions } from '../src/database/typeorm-options';
import { TEST_DATABASE_URL } from './test-env';

const SNAKE_CASE = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;

const notSnakeCase = (names: string[]): string[] =>
  [...new Set(names)].filter((name) => !SNAKE_CASE.test(name)).sort();

describe('database naming convention (e2e)', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = await new DataSource(buildDataSourceOptions(TEST_DATABASE_URL)).initialize();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  it('uses snake_case for every table and column in the migrated schema', async () => {
    const rows: { table_name: string; column_name: string }[] = await dataSource.query(
      `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`,
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(notSnakeCase(rows.flatMap((row) => [row.table_name, row.column_name]))).toEqual([]);
  });

  it('maps every entity to snake_case table and column names', () => {
    const names = dataSource.entityMetadatas.flatMap((metadata) => [
      metadata.tableName,
      ...metadata.columns.map((column) => column.databaseName),
    ]);
    expect(notSnakeCase(names)).toEqual([]);
  });
});
