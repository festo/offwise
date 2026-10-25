import type { DataSourceOptions } from 'typeorm';
import { AuditEvent } from '../audit/audit-event.entity';
import { InstallStepRecord } from '../install/install-step-record.entity';
import { User } from '../modules/users/entities/user.entity';
import { Setting } from '../settings/setting.entity';

/** Every TypeORM entity. Add new entities here; Nest and the TypeORM CLI both read this list. */
export const entities: DataSourceOptions['entities'] = [
  InstallStepRecord,
  User,
  Setting,
  AuditEvent,
];
