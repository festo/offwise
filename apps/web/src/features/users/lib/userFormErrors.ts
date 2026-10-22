import { LAST_ADMIN_RULE } from '@offwise/shared';
import { ApiError } from '@/lib/api';

/** `t` from `useI18n()` or `i18n.global`. */
type Translate = (key: string) => string;

/** Errors shown by `UserForm`. */
export interface UserFormErrors {
  /** The field the server rejected, e.g. `email`. */
  field?: string;
  /** The rule the server enforced, e.g. `last-admin`. */
  rule?: string;
  /** A message, shown under `field` when set, otherwise above the form. */
  message?: string;
}

/** Turns a failed create or update into what `UserForm` shows, with translated messages. */
export function userFormErrors(error: unknown, t: Translate): UserFormErrors {
  if (error instanceof ApiError) {
    if (error.status === 409 && error.rule === LAST_ADMIN_RULE) return { rule: LAST_ADMIN_RULE };
    if (error.status === 409 && error.field === 'email')
      return { field: 'email', message: t('users.form.emailTaken') };
    if (error.status === 400) return { message: t('users.form.rejected') };
  }
  return { message: t('auth.genericError') };
}
