/** E2E tests always use the dedicated test database, never the dev database. */
export const TEST_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgresql://offwise:offwise@localhost:5432/offwise_test';

/** Guards the dev database: e2e suites truncate and migrate, so only `*_test` databases are allowed. */
function assertTestDatabase(databaseUrl: string): void {
  const name = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ''));
  if (!name.endsWith('_test')) {
    throw new Error(`E2E tests must use a database whose name ends in _test, got "${name}"`);
  }
}

export function applyTestEnv(): void {
  assertTestDatabase(TEST_DATABASE_URL);
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL ??= 'error';
  process.env.DATABASE_URL = TEST_DATABASE_URL;
}
