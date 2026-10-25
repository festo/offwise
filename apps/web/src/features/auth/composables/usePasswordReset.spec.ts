import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  apiPost: vi.fn(),
}));

import { ApiError, apiPost } from '@/lib/api';
import { usePasswordReset } from './usePasswordReset';

beforeEach(() => vi.clearAllMocks());

describe('usePasswordReset', () => {
  it('requestReset posts the email', async () => {
    vi.mocked(apiPost).mockResolvedValue(undefined);
    await usePasswordReset().requestReset('ada@example.com');
    expect(apiPost).toHaveBeenCalledWith('/auth/password-reset', { email: 'ada@example.com' });
  });

  it('confirmReset posts the token and the new password', async () => {
    vi.mocked(apiPost).mockResolvedValue(undefined);
    await usePasswordReset().confirmReset('abc_123', 'new-password-1');
    expect(apiPost).toHaveBeenCalledWith('/auth/password-reset/confirm', {
      token: 'abc_123',
      password: 'new-password-1',
    });
  });

  it('propagates API errors', async () => {
    vi.mocked(apiPost).mockRejectedValue(new ApiError(429, 'x', null));
    await expect(usePasswordReset().requestReset('a@b.c')).rejects.toBeInstanceOf(ApiError);
    await expect(usePasswordReset().confirmReset('t', 'p')).rejects.toBeInstanceOf(ApiError);
  });
});
