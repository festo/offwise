import { apiPost } from '@/lib/api';

/** Password reset requests. Errors (ApiError) propagate so pages can word them. */
export function usePasswordReset() {
  /** Asks for a reset link; the API answers the same whether or not the account exists. */
  async function requestReset(email: string): Promise<void> {
    await apiPost('/auth/password-reset', { email });
  }

  /** Sets a new password with the token from the reset link. */
  async function confirmReset(token: string, password: string): Promise<void> {
    await apiPost('/auth/password-reset/confirm', { token, password });
  }

  return { requestReset, confirmReset };
}
