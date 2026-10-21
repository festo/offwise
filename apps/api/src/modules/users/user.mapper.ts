import type { UserDto } from '@offwise/shared';
import type { User } from './entities/user.entity';

/** The user as the admin API returns it; the password hash is reduced to `hasPassword`. */
export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    locale: user.locale,
    timeZone: user.timeZone,
    hasPassword: user.passwordHash !== null,
    createdAt: user.createdAt.toISOString(),
    closedAt: user.deletedAt ? user.deletedAt.toISOString() : null,
  };
}
