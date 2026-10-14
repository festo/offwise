import { afterEach, describe, expect, it, vi } from 'vitest';
import { useHealth } from './useHealth';

afterEach(() => {
  vi.unstubAllGlobals();
});

const respond = (ok: boolean, status: number, body: unknown) =>
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok, status, json: async () => body }));

describe('useHealth', () => {
  it('starts in loading', () => {
    expect(useHealth().state.value).toBe('loading');
  });

  it('is ok when the API reports ok', async () => {
    respond(true, 200, { status: 'ok', db: 'up' });
    const { state, refresh } = useHealth();
    await refresh();
    expect(state.value).toBe('ok');
  });

  it('is error when the API answers 503', async () => {
    respond(false, 503, { status: 'error', db: 'down' });
    const { state, refresh } = useHealth();
    await refresh();
    expect(state.value).toBe('error');
  });

  it('is error when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const { state, refresh } = useHealth();
    await refresh();
    expect(state.value).toBe('error');
  });
});
