import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { CurrentUser } from '@offwise/shared';
import { DataSource } from 'typeorm';
import { AuditService } from '../../audit/audit.service';
import { COMPANY_DEFAULT_TIME_ZONE, companySettings } from '../../settings/company.settings';
import { SettingsService } from '../../settings/settings.service';
import { User } from '../users/entities/user.entity';
import { UserLookupService } from '../users/user-lookup.service';
import { toCurrentUser } from './current-user.mapper';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import {
  LOGIN_EMAIL_LIMIT,
  LOGIN_IP_LIMIT,
  LOGIN_WINDOW_SEC,
  loginEmailKey,
  loginIpKey,
  ThrottleService,
} from './throttle.service';
import { ThrottledException } from './throttled.exception';

export const INVALID_CREDENTIALS = 'Invalid email or password';

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly users: UserLookupService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly throttle: ThrottleService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
  ) {}

  async login(
    email: string,
    password: string,
    ip: string | null,
  ): Promise<{ user: User; sessionId: string }> {
    const emailKey = loginEmailKey(email);
    const ipKey = loginIpKey(ip ?? 'unknown');

    // Count every attempt atomically before the slow verify, so a concurrent burst cannot slip past.
    const [byEmail, byIp] = await Promise.all([
      this.throttle.hit(emailKey, LOGIN_EMAIL_LIMIT, LOGIN_WINDOW_SEC),
      this.throttle.hit(ipKey, LOGIN_IP_LIMIT, LOGIN_WINDOW_SEC),
    ]);
    if (!byEmail.allowed || !byIp.allowed) {
      throw new ThrottledException(Math.max(byEmail.retryAfterSec, byIp.retryAfterSec, 1));
    }

    const user = await this.users.findActiveByEmail(email);

    // A missing user or password verifies against a dummy hash, so timing reveals nothing.
    const ok = await this.passwords.verify(user?.passwordHash ?? null, password);
    if (!user || !ok) {
      await this.audit.record(this.dataSource.manager, {
        actorUserId: null,
        action: 'auth.login_failed',
        entityId: user?.id,
        after: { email },
      });
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    // The IP budget effectively counts failures: a successful login gives its attempt back.
    await Promise.all([this.throttle.clear(emailKey), this.throttle.giveBack(ipKey)]);
    if (this.passwords.needsRehash(user.passwordHash!)) {
      user.passwordHash = await this.passwords.hash(password);
      await this.dataSource
        .getRepository(User)
        .update({ id: user.id }, { passwordHash: user.passwordHash });
    }
    const sessionId = await this.sessions.create(user.id);
    await this.audit.record(this.dataSource.manager, {
      actorUserId: user.id,
      action: 'auth.login_succeeded',
      entityId: user.id,
    });
    return { user, sessionId };
  }

  /** Destroys a session left over from an earlier sign-in; a no-op if it no longer exists. */
  async discardSession(sessionId: string): Promise<void> {
    await this.sessions.destroy(sessionId);
  }

  async logout(sessionId: string, user: User): Promise<void> {
    await this.sessions.destroy(sessionId);
    await this.audit.record(this.dataSource.manager, {
      actorUserId: user.id,
      action: 'auth.logout',
      entityId: user.id,
    });
  }

  async toCurrentUser(user: User): Promise<CurrentUser> {
    const company = await this.settings.get(companySettings);
    return toCurrentUser(user, { locale: company.locale, timeZone: COMPANY_DEFAULT_TIME_ZONE });
  }
}
