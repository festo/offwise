import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { User } from '../modules/users/entities/user.entity';
import { LAST_ADMIN_LOCK_KEY } from '../modules/users/last-admin';
import { UserLookupService } from '../modules/users/user-lookup.service';
import { PasswordService } from '../modules/auth/password.service';
import { BOOTSTRAP_RESET_TTL_SEC, ResetTokenService } from '../modules/auth/reset-token.service';

export type InitialAdminOutcome =
  | 'skipped-not-configured'
  | 'skipped-admin-exists'
  | 'promoted'
  | 'created-with-password'
  | 'created-with-link';

export interface InitialAdminInput {
  email?: string;
  password?: string;
  publicUrl: string;
}

export interface InitialAdminResult {
  outcome: InitialAdminOutcome;
  resetLink?: string;
}

const INITIAL_ADMIN_NAME = 'Administrator';

/** First-admin bootstrap, run by the install command after the install steps (ADR 0006). */
@Injectable()
export class InitialAdminService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly userLookup: UserLookupService,
    private readonly audit: AuditService,
    private readonly passwords: PasswordService,
    private readonly resetTokens: ResetTokenService,
  ) {}

  async run(input: InitialAdminInput): Promise<InitialAdminResult> {
    const { email, password } = input;
    if (!email) return { outcome: 'skipped-not-configured' };
    // Hashed before the transaction so the advisory lock is held only briefly.
    const passwordHash = password ? await this.passwords.hash(password) : null;

    const { outcome, userId, needsLink } = await this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1)', [LAST_ADMIN_LOCK_KEY]);
      const users = manager.getRepository(User);
      if ((await users.count({ where: { role: 'admin' } })) > 0) {
        return { outcome: 'skipped-admin-exists' as const, userId: null, needsLink: false };
      }

      const existing = await this.userLookup.findActiveByEmail(email, manager);
      if (existing) {
        // Promotion keeps the existing password; INITIAL_ADMIN_PASSWORD only applies to new users.
        await users.update({ id: existing.id }, { role: 'admin' });
        await this.audit.record(manager, {
          actorUserId: null,
          action: 'user.role_changed',
          entityId: existing.id,
          before: { role: existing.role },
          after: { role: 'admin' },
        });
        return {
          outcome: 'promoted' as const,
          userId: existing.id,
          needsLink: existing.passwordHash === null,
        };
      }

      const created = await users.save(
        users.create({
          name: INITIAL_ADMIN_NAME,
          email,
          role: 'admin',
          locale: null,
          timeZone: null,
          passwordHash,
        }),
      );
      await this.audit.record(manager, {
        actorUserId: null,
        action: 'user.created',
        entityId: created.id,
        after: {
          name: created.name,
          email: created.email,
          role: created.role,
          locale: created.locale,
          timeZone: created.timeZone,
        },
      });
      return {
        outcome: passwordHash ? ('created-with-password' as const) : ('created-with-link' as const),
        userId: created.id,
        needsLink: !passwordHash,
      };
    });

    if (!needsLink || !userId) return { outcome };
    const token = await this.resetTokens.create(userId, BOOTSTRAP_RESET_TTL_SEC);
    return { outcome, resetLink: `${input.publicUrl}/reset-password#token=${token}` };
  }
}
