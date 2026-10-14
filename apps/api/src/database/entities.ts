import type { DataSourceOptions } from 'typeorm';
import { InstallStepRecord } from '../install/install-step-record.entity';

/** Every TypeORM entity. Add new entities here; Nest and the TypeORM CLI both read this list. */
export const entities: DataSourceOptions['entities'] = [InstallStepRecord];
