import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MailModule } from '../../mail/mail.module';
import { UsersCoreModule } from '../users/users-core.module';
import { AuthController } from './auth.controller';
import { AuthCoreModule } from './auth-core.module';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import { AdminGuard } from './guards/admin.guard';
import { AuthGuard } from './guards/auth.guard';
import { CsrfGuard } from './guards/csrf.guard';

@Module({
  imports: [AuthCoreModule, MailModule, UsersCoreModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordResetService,
    // Global guards run in registration order: CSRF, then session, then role.
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: AdminGuard },
  ],
  exports: [AuthService, AuthCoreModule],
})
export class AuthModule {}
