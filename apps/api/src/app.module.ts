import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    // .env is loaded by dotenv in main.ts / data-source.ts; e2e tests set process.env directly.
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate: validateEnv }),
    DatabaseModule,
    HealthModule,
  ],
})
export class AppModule {}
