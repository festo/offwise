/** `t` from `useI18n()` or `i18n.global`. */
type Translate = (key: string, plural?: number) => string;

/** The 429 message, naming the wait in whole minutes when the API sent `retryAfter` (seconds). */
export function tooManyAttemptsMessage(t: Translate, retryAfter?: number): string {
  if (!retryAfter || retryAfter <= 0) return t('auth.tooManyAttempts');
  return t('auth.tooManyAttemptsAfter', Math.ceil(retryAfter / 60));
}
