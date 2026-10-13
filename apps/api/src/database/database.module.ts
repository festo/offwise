import { Module, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { EnvironmentVariables } from '../config/env.validation';
import { findPendingMigrations } from './pending-migrations';
import { buildDataSourceOptions } from './typeorm-options';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) =>
        buildDataSourceOptions(config.get('DATABASE_URL', { infer: true })),
    }),
  ],
})
export class DatabaseModule implements OnModuleInit {
  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    const pending = await findPendingMigrations(this.dataSource);
    if (pending.length > 0) {
      throw new Error(
        `Database has ${pending.length} pending migration(s): ${pending.join(', ')}. ` +
          'The API does not migrate automatically. Run `pnpm --filter @offwise/api migration:run` ' +
          '(development) or `docker compose run --rm migrate` (containers), then start the API again.',
      );
    }
  }
}
