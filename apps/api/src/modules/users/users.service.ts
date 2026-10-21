import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Page, UserDto } from '@offwise/shared';
import { Brackets, DataSource, type EntityManager, Not, QueryFailedError } from 'typeorm';
import { AuditService } from '../../audit/audit.service';
import { diffFields } from '../../audit/diff';
import { ResetTokenService } from '../auth/reset-token.service';
import { SessionService } from '../auth/session.service';
import type { CreateUserDto } from './dto/create-user.dto';
import type { ListUsersQuery } from './dto/list-users.query';
import type { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { LAST_ADMIN_LOCK_KEY, lastAdminConflict, violatesLastAdmin } from './last-admin';
import { UserLookupService } from './user-lookup.service';
import { toUserDto } from './user.mapper';

export interface Actor {
  userId: string;
}

type AuditedFields = Pick<User, 'name' | 'email' | 'role' | 'locale' | 'timeZone'>;
type Change = { before: Record<string, unknown>; after: Record<string, unknown> };

const EMAIL_UNIQUE_INDEX = 'UQ_users_email_active';
const USER_NOT_FOUND = 'User not found.';

/** Escapes LIKE wildcards (`%`, `_`) and the escape character itself (`\`). */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Splits a change into the `user.updated` fields and the `user.role_changed` part. */
export function userAuditChanges(
  before: AuditedFields,
  after: AuditedFields,
): { updated: Change | null; roleChanged: Change | null } {
  const { role: roleBefore, ...restBefore } = before;
  const { role: roleAfter, ...restAfter } = after;
  return {
    updated: diffFields(restBefore, restAfter),
    roleChanged:
      roleBefore === roleAfter
        ? null
        : { before: { role: roleBefore }, after: { role: roleAfter } },
  };
}

function auditedFields(user: User): AuditedFields {
  return {
    name: user.name,
    email: user.email,
    role: user.role,
    locale: user.locale,
    timeZone: user.timeZone,
  };
}

function emailConflict(): ConflictException {
  return new ConflictException({
    statusCode: 409,
    message: 'A user with this email already exists.',
    field: 'email',
  });
}

/** A concurrent write that slipped past the email check still hits the unique index. */
function mapEmailUniqueViolation(error: unknown): never {
  if (error instanceof QueryFailedError) {
    const driverError = error.driverError as { code?: string; constraint?: string };
    if (driverError.code === '23505' && driverError.constraint === EMAIL_UNIQUE_INDEX) {
      throw emailConflict();
    }
  }
  throw error;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly lookup: UserLookupService,
    private readonly audit: AuditService,
    private readonly sessions: SessionService,
    private readonly resetTokens: ResetTokenService,
  ) {}

  async list(query: ListUsersQuery): Promise<Page<UserDto>> {
    const { page, pageSize } = query;
    const qb = this.dataSource.getRepository(User).createQueryBuilder('user');
    if (query.includeClosed) qb.withDeleted();
    if (query.search) {
      const pattern = `%${escapeLike(query.search)}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where(`user.name ILIKE :pattern ESCAPE '\\'`, { pattern }).orWhere(
            `user.email ILIKE :pattern ESCAPE '\\'`,
            { pattern },
          );
        }),
      );
    }
    const [users, total] = await qb
      .orderBy('lower(user.name)', 'ASC')
      .addOrderBy('user.id', 'ASC')
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .getManyAndCount();
    return { items: users.map(toUserDto), total, page, pageSize };
  }

  async get(id: string): Promise<UserDto> {
    const user = await this.dataSource
      .getRepository(User)
      .findOne({ where: { id }, withDeleted: true });
    if (!user) throw new NotFoundException(USER_NOT_FOUND);
    return toUserDto(user);
  }

  async create(dto: CreateUserDto, actor: Actor): Promise<UserDto> {
    const user = await this.dataSource
      .transaction(async (manager) => {
        await this.assertEmailFree(manager, dto.email, null);
        const created = await manager.getRepository(User).save(
          manager.getRepository(User).create({
            name: dto.name,
            email: dto.email,
            role: dto.role,
            locale: dto.locale ?? null,
            timeZone: dto.timeZone ?? null,
            passwordHash: null,
          }),
        );
        await this.audit.record(manager, {
          actorUserId: actor.userId,
          action: 'user.created',
          entityId: created.id,
          after: { ...auditedFields(created) },
        });
        return created;
      })
      .catch(mapEmailUniqueViolation);
    return toUserDto(user);
  }

  async update(id: string, dto: UpdateUserDto, actor: Actor): Promise<UserDto> {
    const user = await this.dataSource
      .transaction(async (manager) => {
        await this.lockAdmins(manager);
        const repo = manager.getRepository(User);
        const target = await repo.findOne({ where: { id }, withDeleted: true });
        if (!target) throw new NotFoundException(USER_NOT_FOUND);

        if (
          dto.role !== undefined &&
          violatesLastAdmin(target, { role: dto.role }, await this.otherActiveAdmins(manager, id))
        ) {
          throw lastAdminConflict();
        }
        // A closed user's email may be taken by an active user; the closed user does not compete.
        if (dto.email !== undefined && target.deletedAt === null) {
          await this.assertEmailFree(manager, dto.email, id);
        }

        const before = auditedFields(target);
        const after: AuditedFields = {
          name: dto.name ?? before.name,
          email: dto.email ?? before.email,
          role: dto.role ?? before.role,
          locale: dto.locale === undefined ? before.locale : dto.locale,
          timeZone: dto.timeZone === undefined ? before.timeZone : dto.timeZone,
        };
        const { updated, roleChanged } = userAuditChanges(before, after);
        if (!updated && !roleChanged) return target;

        await repo.update({ id }, after);
        // A reset link mailed to the old address must not outlive the change. Inside the
        // transaction, so a Redis failure rolls the email change back.
        if (after.email !== before.email) await this.resetTokens.revokeAllForUser(id);
        for (const [action, change] of [
          ['user.updated', updated],
          ['user.role_changed', roleChanged],
        ] as const) {
          if (!change) continue;
          await this.audit.record(manager, {
            actorUserId: actor.userId,
            action,
            entityId: id,
            before: change.before,
            after: change.after,
          });
        }
        return repo.findOneOrFail({ where: { id }, withDeleted: true });
      })
      .catch(mapEmailUniqueViolation);
    return toUserDto(user);
  }

  /** Soft-deletes the user and ends their sessions once the close is committed. */
  async close(id: string, actor: Actor): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await this.lockAdmins(manager);
      const repo = manager.getRepository(User);
      // Already closed counts as unknown: closing is not repeatable.
      const target = await this.lookup.findActiveById(id, manager);
      if (!target) throw new NotFoundException(USER_NOT_FOUND);
      if (violatesLastAdmin(target, 'close', await this.otherActiveAdmins(manager, id))) {
        throw lastAdminConflict();
      }
      await repo.softDelete({ id });
      await this.audit.record(manager, {
        actorUserId: actor.userId,
        action: 'user.closed',
        entityId: id,
      });
    });
    await this.sessions.destroyAllForUser(id);
  }

  /** Serialises admin-count checks so two concurrent writes cannot both remove an admin. */
  private async lockAdmins(manager: EntityManager): Promise<void> {
    await manager.query('SELECT pg_advisory_xact_lock($1)', [LAST_ADMIN_LOCK_KEY]);
  }

  /** Non-deleted admins other than `id` (find excludes soft-deleted rows). */
  private otherActiveAdmins(manager: EntityManager, id: string): Promise<number> {
    return manager.getRepository(User).count({ where: { role: 'admin', id: Not(id) } });
  }

  private async assertEmailFree(
    manager: EntityManager,
    email: string,
    exceptId: string | null,
  ): Promise<void> {
    const existing = await this.lookup.findActiveByEmail(email, manager);
    if (existing && existing.id !== exceptId) throw emailConflict();
  }
}
