import 'reflect-metadata';
import 'dotenv/config';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { validateEnv } from './config/env.validation';
import { buildDataSourceOptions } from './database/typeorm-options';

/** Migrations are discovered by glob (no list to maintain), as .ts under ts-node and .js in dist. */
const migrations = [join(__dirname, 'migrations', '*{.ts,.js}')];

export default new DataSource(
  buildDataSourceOptions(validateEnv(process.env).DATABASE_URL, migrations),
);
