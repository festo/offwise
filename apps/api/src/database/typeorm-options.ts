import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';
import { entities } from './entities';
import { SnakeNamingStrategy } from './snake-naming.strategy';

/**
 * Migrations are discovered by glob (no list to maintain). Under Vitest the list is empty:
 * TypeORM loads migration files with Node's own require, which bypasses Vitest's SWC transform.
 */
const migrations: DataSourceOptions['migrations'] = process.env.VITEST
  ? []
  : [join(__dirname, '..', 'migrations', '*{.ts,.js}')];

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
