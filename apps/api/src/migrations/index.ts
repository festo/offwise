import type { DataSourceOptions } from 'typeorm';

/** Every migration, oldest first. After `migration:generate`, add the new class here. */
export const migrations: DataSourceOptions['migrations'] = [];
