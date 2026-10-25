import { Redis } from 'ioredis';
import { TEST_PUBLIC_URL, TEST_REDIS_URL, assertTestRedis } from '../test-env';

export { TEST_PUBLIC_URL, TEST_REDIS_URL };

/** Empties the dedicated e2e Redis database. Refuses database 0. */
export async function flushTestRedis(): Promise<void> {
  assertTestRedis(TEST_REDIS_URL);
  const client = new Redis(TEST_REDIS_URL);
  try {
    await client.flushdb();
  } finally {
    await client.quit();
  }
}
