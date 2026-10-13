import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { validateEnv } from './config/env.validation';
import { buildDataSourceOptions } from './database/typeorm-options';

export default new DataSource(buildDataSourceOptions(validateEnv(process.env).DATABASE_URL));
