import type { InstallStep } from './install-step';

/**
 * Every module's install steps, in the order the install command (`install:run`) applies them (ADR 0006).
 * Append new steps; never rename or reorder existing ones.
 */
export const installSteps: readonly InstallStep[] = [];
