import type { Page, UserDto } from '@offwise/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));

import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';
import { useUsers } from './useUsers';

const user: UserDto = {
  id: 'u1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  role: 'admin',
  locale: null,
  timeZone: null,
  hasPassword: true,
  createdAt: '2026-10-01T00:00:00.000Z',
  closedAt: null,
};
const page: Page<UserDto> = { items: [user], total: 1, page: 1, pageSize: 25 };

beforeEach(() => vi.clearAllMocks());

describe('useUsers', () => {
  it('starts empty with page 1 and no filters', () => {
    const { page: current, query, loading, error } = useUsers();
    expect(current.value).toBeNull();
    expect(loading.value).toBe(false);
    expect(error.value).toBeNull();
    expect(query).toEqual({ search: '', includeClosed: false, page: 1 });
  });

  it('fetches page 1 without filters', async () => {
    vi.mocked(apiGet).mockResolvedValue(page);
    const users = useUsers();
    await users.fetch();
    expect(apiGet).toHaveBeenCalledWith('/users?page=1');
    expect(users.page.value).toEqual(page);
    expect(users.loading.value).toBe(false);
  });

  it('puts the trimmed search, includeClosed=true and the page in the query string', async () => {
    vi.mocked(apiGet).mockResolvedValue(page);
    const users = useUsers();
    users.query.search = '  ada & co ';
    users.query.includeClosed = true;
    users.query.page = 3;
    await users.fetch();
    expect(apiGet).toHaveBeenCalledWith('/users?search=ada+%26+co&includeClosed=true&page=3');
  });

  it('is loading while the request runs', async () => {
    let resolve!: (value: Page<UserDto>) => void;
    vi.mocked(apiGet).mockReturnValue(new Promise((r) => (resolve = r)));
    const users = useUsers();
    const done = users.fetch();
    expect(users.loading.value).toBe(true);
    resolve(page);
    await done;
    expect(users.loading.value).toBe(false);
  });

  it('keeps the API error of a failed list request', async () => {
    vi.mocked(apiGet).mockRejectedValue(new ApiError(500, 'boom', null));
    const users = useUsers();
    await users.fetch();
    expect(users.error.value).toBeInstanceOf(ApiError);
    expect(users.error.value?.status).toBe(500);
    expect(users.loading.value).toBe(false);
  });

  it('maps a network failure to an ApiError with status 0', async () => {
    vi.mocked(apiGet).mockRejectedValue(new TypeError('Failed to fetch'));
    const users = useUsers();
    await users.fetch();
    expect(users.error.value).toBeInstanceOf(ApiError);
    expect(users.error.value?.status).toBe(0);
  });

  it('clears the previous error on a successful fetch', async () => {
    vi.mocked(apiGet).mockRejectedValueOnce(new ApiError(500, 'boom', null));
    vi.mocked(apiGet).mockResolvedValueOnce(page);
    const users = useUsers();
    await users.fetch();
    await users.fetch();
    expect(users.error.value).toBeNull();
  });

  it('gets one user by id', async () => {
    vi.mocked(apiGet).mockResolvedValue(user);
    await expect(useUsers().getUser('a/b')).resolves.toEqual(user);
    expect(apiGet).toHaveBeenCalledWith('/users/a%2Fb');
  });

  it('creates, updates and closes users', async () => {
    vi.mocked(apiPost).mockResolvedValue(user);
    vi.mocked(apiPatch).mockResolvedValue(user);
    vi.mocked(apiDelete).mockResolvedValue(undefined);
    const users = useUsers();
    const body = { name: 'Ada', email: 'ada@example.com', role: 'admin' as const };
    await expect(users.createUser(body)).resolves.toEqual(user);
    expect(apiPost).toHaveBeenCalledWith('/users', body);
    await expect(users.updateUser('u1', { name: 'Ada L' })).resolves.toEqual(user);
    expect(apiPatch).toHaveBeenCalledWith('/users/u1', { name: 'Ada L' });
    await users.closeUser('u1');
    expect(apiDelete).toHaveBeenCalledWith('/users/u1');
  });

  it('rethrows API errors of mutations with field and rule intact', async () => {
    vi.mocked(apiPost).mockRejectedValue(
      new ApiError(409, 'taken', { statusCode: 409, message: 'taken', field: 'email' }),
    );
    vi.mocked(apiDelete).mockRejectedValue(
      new ApiError(409, 'last', { statusCode: 409, message: 'last', rule: 'last-admin' }),
    );
    const users = useUsers();
    await expect(
      users.createUser({ name: 'A', email: 'a@b.c', role: 'employee' }),
    ).rejects.toMatchObject({ status: 409, field: 'email' });
    await expect(users.closeUser('u1')).rejects.toMatchObject({ status: 409, rule: 'last-admin' });
  });

  it('maps a network failure of a mutation to an ApiError with status 0', async () => {
    vi.mocked(apiPatch).mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(useUsers().updateUser('u1', { name: 'x' })).rejects.toMatchObject({
      name: 'ApiError',
      status: 0,
    });
  });
});
