import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { validateEnv } from './config/env.validation';
import { toNestLogLevels } from './config/log-levels';

async function bootstrap(): Promise<void> {
  // Validated here too (not only in ConfigModule) because PORT and LOG_LEVEL are needed before Nest starts.
  const env = validateEnv(process.env);
  const app = await NestFactory.create(AppModule, { logger: toNestLogLevels(env.LOG_LEVEL) });
  configureApp(app);
  app.enableShutdownHooks();
  await app.listen(env.PORT);
}

void bootstrap();
