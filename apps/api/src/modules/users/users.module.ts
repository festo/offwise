import { Module } from '@nestjs/common';
import { AuthCoreModule } from '../auth/auth-core.module';
import { UsersCoreModule } from './users-core.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuthCoreModule, UsersCoreModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
