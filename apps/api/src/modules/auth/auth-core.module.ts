import { Module } from '@nestjs/common';
import { PasswordService } from './password.service';
import { ResetTokenService } from './reset-token.service';
import { SessionService } from './session.service';
import { ThrottleService } from './throttle.service';

@Module({
  providers: [PasswordService, SessionService, ThrottleService, ResetTokenService],
  exports: [PasswordService, SessionService, ThrottleService, ResetTokenService],
})
export class AuthCoreModule {}
