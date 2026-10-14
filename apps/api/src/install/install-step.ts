import type { EntityManager } from 'typeorm';

/**
 * Seeds a module's defaults exactly once per installation (ADR 0003).
 * `name` is permanent: renaming a step makes it run again on every installation.
 */
export interface InstallStep {
  readonly name: string;
  run(manager: EntityManager): Promise<void>;
}
