import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { applyTestEnv, TEST_DATABASE_URL } from './test-env';

/** Runs once before all e2e suites: bring the test database schema up to date via the TypeORM CLI. */
export default function globalSetup(): void {
  applyTestEnv();
  const apiRoot = join(__dirname, '..');
  // Vitest marks its process with VITEST; the CLI child must load real migration files, so drop it.
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: TEST_DATABASE_URL,
  };
  delete env.VITEST;
  const result = spawnSync(
    join(apiRoot, 'node_modules', '.bin', 'typeorm-ts-node-commonjs'),
    ['-d', 'src/data-source.ts', 'migration:run'],
    {
      cwd: apiRoot,
      env,
      stdio: 'inherit',
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Test database migration failed (exit code ${result.status})`);
  }
}
