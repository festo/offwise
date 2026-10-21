import { Module } from '@nestjs/common';
import { UserLookupService } from './user-lookup.service';

/** User reads needed outside user management (auth, install). Imports nothing from auth. */
@Module({
  providers: [UserLookupService],
  exports: [UserLookupService],
})
export class UsersCoreModule {}
