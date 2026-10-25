import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { validateEnv } from './config/env.validation';
import { toNestLogLevels } from './config/log-levels';
import { InitialAdminService } from './install/initial-admin.service';
import { InstallCliModule } from './install/install-cli.module';
import { InstallStepRunner } from './install/install-step-runner.service';
import { installSteps } from './install/install-steps.registry';

async function install(): Promise<void> {
  const env = validateEnv(process.env);
  const context = await NestFactory.createApplicationContext(InstallCliModule, {
    logger: toNestLogLevels(env.LOG_LEVEL),
  });
  try {
    const applied = await context.get(InstallStepRunner).run(installSteps);
    console.log(
      applied.length === 0
        ? 'No pending install steps.'
        : `Applied install steps: ${applied.join(', ')}`,
    );
    const admin = await context.get(InitialAdminService).run({
      email: env.INITIAL_ADMIN_EMAIL,
      password: env.INITIAL_ADMIN_PASSWORD,
      publicUrl: env.PUBLIC_URL,
    });
    console.log(`Initial admin: ${admin.outcome}`);
    if (admin.resetLink) {
      console.log(`Set the initial admin password within 24 hours: ${admin.resetLink}`);
    }
  } finally {
    await context.close();
  }
}

install().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
