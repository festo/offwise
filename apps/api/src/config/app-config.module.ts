import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './env.validation';

@Module({
  imports: [
    // .env is loaded by dotenv in main.ts / install.ts / data-source.ts; e2e tests set process.env directly.
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate: validateEnv }),
  ],
  exports: [ConfigModule],
})
export class AppConfigModule {}
