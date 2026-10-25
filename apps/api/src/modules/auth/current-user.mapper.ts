import type { CurrentUser } from '@offwise/shared';
import type { User } from '../users/entities/user.entity';

export interface CompanyDefaults {
  locale: string;
  timeZone: string;
}

/** The user as the web app sees it: preferences with company defaults applied. */
export function toCurrentUser(user: User, defaults: CompanyDefaults): CurrentUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    locale: user.locale ?? defaults.locale,
    timeZone: user.timeZone ?? defaults.timeZone,
  };
}
