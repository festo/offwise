import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { AuditService } from '../../audit/audit.service';
import type { EnvironmentVariables } from '../../config/env.validation';
import { MailService } from '../../mail/mail.service';
import { passwordResetEmail } from '../../mail/templates/password-reset';
import { User } from '../users/entities/user.entity';
import { UserLookupService } from '../users/user-lookup.service';
import { PasswordService } from './password.service';
import { ResetTokenService } from './reset-token.service';
import { SessionService } from './session.service';
import {
  loginEmailKey,
  RESET_EMAIL_LIMIT,
  RESET_WINDOW_SEC,
  resetEmailKey,
  ThrottleService,
} from './throttle.service';
import { ThrottledException } from './throttled.exception';

export const INVALID_RESET_LINK = 'This reset link is invalid or has expired.';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private readonly publicUrl: string;

  constructor(
    private readonly dataSource: DataSource,
    private readonly users: UserLookupService,
    private readonly throttle: ThrottleService,
    private readonly tokens: ResetTokenService,
    private readonly sessions: SessionService,
    private readonly passwords: PasswordService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.publicUrl = config.get('PUBLIC_URL', { infer: true });
  }

  /** Throttles, then does the work after the response so timing never reveals whether the email exists. */
  async request(email: string): Promise<void> {
    const { allowed, retryAfterSec } = await this.throttle.hit(
      resetEmailKey(email),
      RESET_EMAIL_LIMIT,
      RESET_WINDOW_SEC,
    );
    if (!allowed) throw new ThrottledException(retryAfterSec);
    setImmediate(() => {
      this.sendResetEmail(email).catch((error: unknown) => {
        this.logger.error(
          'Password reset email failed',
          error instanceof Error ? error.stack : String(error),
        );
      });
    });
  }

  async confirm(token: string, password: string): Promise<void> {
    const userId = await this.tokens.consume(token);
    const user = userId ? await this.users.findActiveById(userId) : null;
    if (!user) throw new BadRequestException(INVALID_RESET_LINK);

    const passwordHash = await this.passwords.hash(password);
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(User).update({ id: user.id }, { passwordHash });
      await this.audit.record(manager, {
        actorUserId: user.id,
        action: 'auth.password_reset_completed',
        entityId: user.id,
      });
      // Inside the transaction: if Redis fails, the password change rolls back, so the user never
      // has a new password while old sessions or reset links still work.
      await this.tokens.revokeAllForUser(user.id);
      await this.sessions.destroyAllForUser(user.id);
    });
    // The owner just proved control of the mailbox: lift a login lockout on the email.
    await this.throttle.clear(loginEmailKey(user.email));
  }

  private async sendResetEmail(email: string): Promise<void> {
    const user = await this.users.findActiveByEmail(email);
    if (!user) return;
    const token = await this.tokens.create(user.id);
    const link = `${this.publicUrl}/reset-password#token=${token}`;
    await this.mail.send({ to: user.email, ...passwordResetEmail({ name: user.name, link }) });
    await this.audit.record(this.dataSource.manager, {
      actorUserId: null,
      action: 'auth.password_reset_requested',
      entityId: user.id,
    });
  }
}
