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

/** E2E tests use their own Redis database; flushTestRedis empties it, so database 0 is never allowed. */
export const TEST_REDIS_URL = process.env.E2E_REDIS_URL ?? 'redis://localhost:6379/1';

export const TEST_PUBLIC_URL = 'http://localhost:5173';

export function assertTestRedis(redisUrl: string): void {
  const segment = new URL(redisUrl).pathname.replace(/^\//, '');
  // Numeric, so "/00" is database 0 too; an empty path is the default database 0.
  if (segment === '' || Number(segment) === 0) {
    throw new Error('E2E tests must use a Redis database other than 0');
  }
}

export function applyTestEnv(): void {
  assertTestDatabase(TEST_DATABASE_URL);
  assertTestRedis(TEST_REDIS_URL);
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL ??= 'error';
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.REDIS_URL = TEST_REDIS_URL;
  process.env.PUBLIC_URL = TEST_PUBLIC_URL;
  process.env.SESSION_SECRET = 'test-session-secret-0123456789abcdef';
  process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  process.env.SMTP_HOST = 'localhost';
  process.env.SMTP_PORT = '1025';
  process.env.MAIL_FROM = 'offwise <noreply@offwise.local>';
  delete process.env.INITIAL_ADMIN_EMAIL;
  delete process.env.INITIAL_ADMIN_PASSWORD;
}
