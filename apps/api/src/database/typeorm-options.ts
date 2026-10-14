import type { DataSourceOptions } from 'typeorm';
import { entities } from './entities';
import { SnakeNamingStrategy } from './snake-naming.strategy';

/**
 * The single options object shared by TypeOrmModule and the CLI data source.
 * Only the CLI data source passes migrations: the API never runs or checks them (ADR 0006).
 */
export function buildDataSourceOptions(
  databaseUrl: string,
  migrations: DataSourceOptions['migrations'] = [],
): DataSourceOptions {
  return {
    type: 'postgres',
    url: databaseUrl,
    entities,
    migrations,
    migrationsTableName: 'migrations',
    namingStrategy: new SnakeNamingStrategy(),
    // Never migrate on startup; migrations run only through an explicit command.
    synchronize: false,
  };
}
