import type { INestApplicationContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource, type EntityManager } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InstallStep } from '../src/install/install-step';
import { InstallCliModule } from '../src/install/install-cli.module';
import { InstallStepRecord } from '../src/install/install-step-record.entity';
import { InstallStepRunner } from '../src/install/install-step-runner.service';
import { resetDatabase } from './utils/reset-database';
import { runApiCli } from './utils/run-api-cli';

describe('InstallStepRunner (e2e)', () => {
  let app: INestApplicationContext;
  let dataSource: DataSource;
  let runner: InstallStepRunner;

  const recordedNames = async (): Promise<string[]> =>
    (await dataSource.getRepository(InstallStepRecord).find({ order: { name: 'ASC' } })).map(
      (record) => record.name,
    );

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [InstallCliModule] }).compile();
    app = await moduleRef.init();
    dataSource = app.get(DataSource);
    runner = app.get(InstallStepRunner);
  });

  beforeEach(async () => {
    await resetDatabase(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('runs pending steps in order, records them, and never runs them again', async () => {
    const calls: string[] = [];
    const steps: InstallStep[] = ['test.first', 'test.second'].map((name) => ({
      name,
      run: async () => {
        calls.push(name);
      },
    }));

    await expect(runner.run(steps)).resolves.toEqual(['test.first', 'test.second']);
    await expect(runner.run(steps)).resolves.toEqual([]);

    expect(calls).toEqual(['test.first', 'test.second']);
    expect(await recordedNames()).toEqual(['test.first', 'test.second']);
  });

  it('runs only steps added since the last run', async () => {
    const first: InstallStep = { name: 'test.first', run: vi.fn() };
    const later: InstallStep = { name: 'test.later', run: vi.fn() };

    await runner.run([first]);
    await expect(runner.run([first, later])).resolves.toEqual(['test.later']);
    expect(first.run).toHaveBeenCalledTimes(1);
  });

  it('rolls back a failing step, does not record it, and stops before later steps', async () => {
    const failing: InstallStep = {
      name: 'test.failing',
      run: async (manager: EntityManager) => {
        await manager.insert(InstallStepRecord, { name: 'test.partial-write' });
        throw new Error('boom');
      },
    };
    const after: InstallStep = { name: 'test.after', run: vi.fn() };

    await expect(runner.run([failing, after])).rejects.toThrow('boom');

    expect(after.run).not.toHaveBeenCalled();
    expect(await recordedNames()).toEqual([]);
  });

  it('runs a step exactly once when two runners start concurrently', async () => {
    let invocations = 0;
    const slow: InstallStep = {
      name: 'test.slow',
      run: async () => {
        invocations += 1;
        await new Promise((resolve) => setTimeout(resolve, 100));
      },
    };

    const results = await Promise.all([runner.run([slow]), runner.run([slow])]);

    expect(invocations).toBe(1);
    expect(await recordedNames()).toEqual(['test.slow']);
    expect(results.map((applied) => applied.length).sort()).toEqual([0, 1]);
    expect(results.flat()).toEqual(['test.slow']);
  });

  it('the install command exits 0 and is idempotent against the test database', () => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = runApiCli('ts-node', ['src/install.ts']);
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain('No pending install steps.');
    }
  }, 60_000);
});
