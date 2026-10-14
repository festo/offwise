import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiGet } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiGet', () => {
  it('calls /api on the same origin and returns the JSON body', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ a: 1 }) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiGet<{ a: number }>('/thing')).resolves.toEqual({ a: 1 });
    expect(fetchMock).toHaveBeenCalledWith('/api/thing', {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    });
  });

  it('throws ApiError with the status for non-2xx responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }),
    );

    await expect(apiGet('/thing')).rejects.toMatchObject({ name: 'ApiError', status: 503 });
    await expect(apiGet('/thing')).rejects.toBeInstanceOf(ApiError);
  });
});
