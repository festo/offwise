import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { InstallStep } from './install-step';
import { InstallStepRecord } from './install-step-record.entity';

/** Arbitrary constant key; serialises install steps across concurrent install runs. */
const INSTALL_LOCK_KEY = 4_242_001;

@Injectable()
export class InstallStepRunner {
  private readonly logger = new Logger(InstallStepRunner.name);

  constructor(private readonly dataSource: DataSource) {}

  /** Runs every step not yet recorded, each in its own transaction. Returns the names applied now. */
  async run(steps: readonly InstallStep[]): Promise<string[]> {
    assertUniqueNames(steps);

    const applied: string[] = [];
    for (const step of steps) {
      const ran = await this.dataSource.transaction(async (manager) => {
        await manager.query('SELECT pg_advisory_xact_lock($1)', [INSTALL_LOCK_KEY]);
        if (await manager.existsBy(InstallStepRecord, { name: step.name })) {
          return false;
        }
        await step.run(manager);
        await manager.insert(InstallStepRecord, { name: step.name });
        return true;
      });
      if (ran) {
        applied.push(step.name);
        this.logger.log(`Applied install step ${step.name}`);
      }
    }
    return applied;
  }
}

function assertUniqueNames(steps: readonly InstallStep[]): void {
  const seen = new Set<string>();
  for (const step of steps) {
    if (seen.has(step.name)) {
      throw new Error(`Duplicate install step name: ${step.name}`);
    }
    seen.add(step.name);
  }
}
