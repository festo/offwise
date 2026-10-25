import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiDelete, apiGet, apiPatch, apiPost, onUnauthorized } from './api';

function respond(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
  });
}

function stubFetch(response: Response) {
  const fetchMock = vi.fn().mockImplementation(async () => response.clone());
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  onUnauthorized(null);
});

describe('requests', () => {
  it('GET calls /api on the same origin with the standard headers', async () => {
    const fetchMock = stubFetch(respond(200, { a: 1 }));

    await expect(apiGet<{ a: number }>('/thing')).resolves.toEqual({ a: 1 });
    expect(fetchMock).toHaveBeenCalledWith('/api/thing', {
      method: 'GET',
      headers: { Accept: 'application/json', 'X-Requested-With': 'offwise' },
      credentials: 'same-origin',
    });
  });

  it.each([
    ['GET', () => apiGet('/x')],
    ['POST', () => apiPost('/x')],
    ['PATCH', () => apiPatch('/x', {})],
    ['DELETE', () => apiDelete('/x')],
  ])('%s sends the CSRF header', async (method, call) => {
    const fetchMock = stubFetch(respond(200, {}));
    await call();
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe(method);
    expect(init.headers).toMatchObject({
      Accept: 'application/json',
      'X-Requested-With': 'offwise',
    });
    expect(init.credentials).toBe('same-origin');
  });

  it('POST and PATCH send a JSON body with its content type', async () => {
    const fetchMock = stubFetch(respond(200, {}));
    await apiPost('/x', { a: 1 });
    await apiPatch('/y', { b: 2 });

    const [, post] = fetchMock.mock.calls[0]!;
    expect(post.body).toBe('{"a":1}');
    expect(post.headers['Content-Type']).toBe('application/json');
    const [, patch] = fetchMock.mock.calls[1]!;
    expect(patch.body).toBe('{"b":2}');
    expect(patch.headers['Content-Type']).toBe('application/json');
  });

  it('POST without a body sends no body and no content type', async () => {
    const fetchMock = stubFetch(respond(200, {}));
    await apiPost('/x');
    const init = fetchMock.mock.calls[0]![1] as RequestInit & { headers: Record<string, string> };
    expect(init.body).toBeUndefined();
    expect(init.headers['Content-Type']).toBeUndefined();
  });

  it('returns undefined for 204', async () => {
    stubFetch(respond(204));
    await expect(apiPost('/auth/logout')).resolves.toBeUndefined();
  });
});

describe('errors', () => {
  it('throws ApiError with status and message from the body', async () => {
    stubFetch(respond(401, { statusCode: 401, message: 'Invalid credentials' }));

    const error = await apiPost('/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ name: 'ApiError', status: 401, message: 'Invalid credentials' });
  });

  it('joins an array message with newlines', async () => {
    stubFetch(respond(400, { statusCode: 400, message: ['a is bad', 'b is bad'] }));
    await expect(apiPost('/x')).rejects.toMatchObject({ message: 'a is bad\nb is bad' });
  });

  it('exposes field, rule and retryAfter', async () => {
    stubFetch(respond(409, { statusCode: 409, message: 'x', field: 'email', rule: 'last-admin' }));
    await expect(apiPost('/x')).rejects.toMatchObject({ field: 'email', rule: 'last-admin' });

    stubFetch(respond(429, { statusCode: 429, message: 'slow', retryAfter: 42 }));
    await expect(apiPost('/x')).rejects.toMatchObject({ status: 429, retryAfter: 42 });
  });

  it('falls back to a generic message without a JSON body', async () => {
    stubFetch(new Response('<html>', { status: 502 }));
    await expect(apiGet('/x')).rejects.toMatchObject({
      status: 502,
      body: null,
      message: 'GET /x failed with status 502',
    });
  });
});

describe('malformed responses', () => {
  it('turns an unparseable 2xx body into an ApiError', async () => {
    stubFetch(new Response('<html>proxy page</html>', { status: 200 }));
    const error = await apiGet('/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 200,
      body: null,
      message: 'GET /x returned an invalid response',
    });
  });

  it.each([
    ['an object', { nested: true }],
    ['a number', 42],
    ['null', null],
    ['an array with non-strings', ['a', 1]],
  ])('uses a generic message when the error message is %s', async (_, message) => {
    stubFetch(respond(500, { statusCode: 500, message }));
    const error = await apiGet('/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe('GET /x failed with status 500');
  });
});

describe('onUnauthorized', () => {
  it('is called on a 401', async () => {
    const handler = vi.fn();
    onUnauthorized(handler);
    stubFetch(respond(401, { statusCode: 401, message: 'no' }));
    await expect(apiGet('/users')).rejects.toBeInstanceOf(ApiError);
    expect(handler).toHaveBeenCalledOnce();
  });

  it.each(['/auth/me', '/auth/login', '/auth/logout'])('is not called for %s', async (path) => {
    const handler = vi.fn();
    onUnauthorized(handler);
    stubFetch(respond(401, { statusCode: 401, message: 'no' }));
    await expect(apiPost(path)).rejects.toBeInstanceOf(ApiError);
    expect(handler).not.toHaveBeenCalled();
  });

  it('is not called for other statuses', async () => {
    const handler = vi.fn();
    onUnauthorized(handler);
    stubFetch(respond(403, { statusCode: 403, message: 'no' }));
    await expect(apiGet('/users')).rejects.toBeInstanceOf(ApiError);
    expect(handler).not.toHaveBeenCalled();
  });
});
