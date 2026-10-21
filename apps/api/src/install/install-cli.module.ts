import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/app-config.module';
import { AuditModule } from '../audit/audit.module';
import { DatabaseModule } from '../database/database.module';
import { AuthCoreModule } from '../modules/auth/auth-core.module';
import { UsersCoreModule } from '../modules/users/users-core.module';
import { RedisModule } from '../redis/redis.module';
import { InitialAdminService } from './initial-admin.service';
import { InstallModule } from './install.module';

/** Root module of the install command (`src/install.ts`): config, database, Redis, audit, auth primitives, the step runner and the first-admin bootstrap, no HTTP. */
@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    RedisModule,
    AuditModule,
    AuthCoreModule,
    UsersCoreModule,
    InstallModule,
  ],
  providers: [InitialAdminService],
})
export class InstallCliModule {}
