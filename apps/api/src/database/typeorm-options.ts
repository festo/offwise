import type { DataSourceOptions } from 'typeorm';
import { migrations } from '../migrations';
import { entities } from './entities';
import { SnakeNamingStrategy } from './snake-naming.strategy';

/** The single options object shared by TypeOrmModule and the CLI data source. */
export function buildDataSourceOptions(databaseUrl: string): DataSourceOptions {
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
