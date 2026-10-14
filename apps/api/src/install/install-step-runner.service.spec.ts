import type { DataSource } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import type { InstallStep } from './install-step';
import { InstallStepRunner } from './install-step-runner.service';

const step = (name: string): InstallStep => ({ name, run: vi.fn() });

describe('InstallStepRunner', () => {
  it('rejects duplicate step names before touching the database', async () => {
    const transaction = vi.fn();
    const runner = new InstallStepRunner({ transaction } as unknown as DataSource);

    await expect(runner.run([step('a.one'), step('a.one')])).rejects.toThrow(
      'Duplicate install step name: a.one',
    );
    expect(transaction).not.toHaveBeenCalled();
  });
});
