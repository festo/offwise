import { ConflictException } from '@nestjs/common';
import { LAST_ADMIN_RULE, type Role } from '@offwise/shared';

/** Serialises every write that could remove an active admin (pg_advisory_xact_lock key). */
export const LAST_ADMIN_LOCK_KEY = 4242002;

export const LAST_ADMIN_MESSAGE = 'The last active admin cannot be closed or lose the admin role.';

export function lastAdminConflict(): ConflictException {
  return new ConflictException({
    statusCode: 409,
    message: LAST_ADMIN_MESSAGE,
    rule: LAST_ADMIN_RULE,
  });
}

/**
 * True when the change would leave no active admin: the target is an active admin, no other
 * active admin exists, and the change closes the target or gives it another role.
 */
export function violatesLastAdmin(
  target: { role: Role; deletedAt: Date | null },
  change: { role?: Role } | 'close',
  otherActiveAdmins: number,
): boolean {
  if (target.role !== 'admin' || target.deletedAt !== null) return false;
  if (otherActiveAdmins > 0) return false;
  if (change === 'close') return true;
  return change.role !== undefined && change.role !== 'admin';
}
