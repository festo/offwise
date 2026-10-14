import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/app-config.module';
import { DatabaseModule } from '../database/database.module';
import { InstallModule } from './install.module';

/** Root module of the install command (`src/install.ts`): config, database and the step runner, no HTTP. */
@Module({ imports: [AppConfigModule, DatabaseModule, InstallModule] })
export class InstallCliModule {}
