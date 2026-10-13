import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../src/database/typeorm-options';
import { applyTestEnv, TEST_DATABASE_URL } from './test-env';

/** Runs once before all e2e suites: bring the test database schema up to date. */
export default async function globalSetup(): Promise<void> {
  applyTestEnv();
  const dataSource = new DataSource(buildDataSourceOptions(TEST_DATABASE_URL));
  await dataSource.initialize();
  try {
    await dataSource.runMigrations();
  } finally {
    await dataSource.destroy();
  }
}
