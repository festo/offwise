import type { CurrentUser } from '@offwise/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));
vi.mock('@/i18n', () => ({ setLocaleFromTag: vi.fn() }));

import { setLocaleFromTag } from '@/i18n';
import { ApiError, apiGet, apiPost } from '@/lib/api';
import { resetSessionForTests, useSession } from './useSession';

const user: CurrentUser = {
  id: 'u1',
  name: 'Ada',
  email: 'ada@example.com',
  role: 'employee',
  locale: 'en-GB',
  timeZone: 'UTC',
};

beforeEach(() => {
  vi.clearAllMocks();
  resetSessionForTests();
});

describe('useSession', () => {
  it('load sets the user, marks loaded and applies the locale', async () => {
    vi.mocked(apiGet).mockResolvedValue(user);
    const s = useSession();
    await s.load();
    expect(apiGet).toHaveBeenCalledWith('/auth/me');
    expect(s.user.value).toEqual(user);
    expect(s.loaded.value).toBe(true);
    expect(setLocaleFromTag).toHaveBeenCalledWith('en-GB');
  });

  it('load on 401 leaves user null and loaded true', async () => {
    vi.mocked(apiGet).mockRejectedValue(new ApiError(401, 'no', null));
    const s = useSession();
    await s.load();
    expect(s.user.value).toBeNull();
    expect(s.loaded.value).toBe(true);
  });

  it('load twice fetches once', async () => {
    vi.mocked(apiGet).mockResolvedValue(user);
    const s = useSession();
    await Promise.all([s.load(), s.load()]);
    await s.load();
    expect(apiGet).toHaveBeenCalledTimes(1);
  });

  it('load rethrows non-401 errors and stays unloaded', async () => {
    vi.mocked(apiGet).mockRejectedValue(new ApiError(500, 'boom', null));
    const s = useSession();
    await expect(s.load()).rejects.toMatchObject({ status: 500 });
    expect(s.loaded.value).toBe(false);
  });

  it('login posts credentials, sets the user and applies the locale', async () => {
    vi.mocked(apiPost).mockResolvedValue(user);
    const s = useSession();
    await s.login('ada@example.com', 'secret-password');
    expect(apiPost).toHaveBeenCalledWith('/auth/login', {
      email: 'ada@example.com',
      password: 'secret-password',
    });
    expect(s.user.value).toEqual(user);
    expect(s.loaded.value).toBe(true);
    expect(setLocaleFromTag).toHaveBeenCalledWith('en-GB');
  });

  it('login failure propagates and keeps user null', async () => {
    vi.mocked(apiPost).mockRejectedValue(new ApiError(401, 'bad', null));
    const s = useSession();
    await expect(s.login('a@b.c', 'x')).rejects.toBeInstanceOf(ApiError);
    expect(s.user.value).toBeNull();
  });

  it('logout posts and clears the user', async () => {
    vi.mocked(apiPost).mockResolvedValueOnce(user).mockResolvedValueOnce(undefined);
    const s = useSession();
    await s.login('a@b.c', 'x');
    await s.logout();
    expect(apiPost).toHaveBeenLastCalledWith('/auth/logout');
    expect(s.user.value).toBeNull();
  });

  it('logout clears the user even if the API answers 401', async () => {
    vi.mocked(apiPost)
      .mockResolvedValueOnce(user)
      .mockRejectedValueOnce(new ApiError(401, 'no', null));
    const s = useSession();
    await s.login('a@b.c', 'x');
    await expect(s.logout()).resolves.toBeUndefined();
    expect(s.user.value).toBeNull();
  });

  it('isAdmin reflects the role', async () => {
    const s = useSession();
    expect(s.isAdmin.value).toBe(false);
    vi.mocked(apiPost).mockResolvedValue({ ...user, role: 'admin' });
    await s.login('a@b.c', 'x');
    expect(s.isAdmin.value).toBe(true);
  });

  it('shares state between callers', async () => {
    vi.mocked(apiPost).mockResolvedValue(user);
    await useSession().login('a@b.c', 'x');
    expect(useSession().user.value).toEqual(user);
  });
});
