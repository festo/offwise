import { applyTestEnv } from './test-env';
import { runApiCli } from './utils/run-api-cli';

/** Runs once before all e2e suites: bring the test database schema up to date via the TypeORM CLI. */
export default function globalSetup(): void {
  applyTestEnv();
  const result = runApiCli(
    'typeorm-ts-node-commonjs',
    ['-d', 'src/data-source.ts', 'migration:run'],
    { inheritOutput: true },
  );
  if (result.status !== 0) {
    throw new Error(`Test database migration failed (exit code ${result.status})`);
  }
}
