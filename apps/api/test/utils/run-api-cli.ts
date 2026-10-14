import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { join } from 'node:path';
import { TEST_DATABASE_URL } from '../test-env';

const apiRoot = join(__dirname, '..', '..');

/** Runs a node_modules/.bin command from the api root as a separate process against the test database. */
export function runApiCli(
  bin: string,
  args: string[],
  options: { inheritOutput?: boolean } = {},
): SpawnSyncReturns<string> {
  const result = spawnSync(join(apiRoot, 'node_modules', '.bin', bin), args, {
    cwd: apiRoot,
    env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: TEST_DATABASE_URL },
    encoding: 'utf8',
    stdio: options.inheritOutput ? 'inherit' : 'pipe',
  });
  if (result.error) throw result.error;
  return result;
}
