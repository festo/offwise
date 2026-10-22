import { API_PREFIX, CSRF_HEADER, CSRF_HEADER_VALUE, type ApiErrorBody } from '@offwise/shared';

export class ApiError extends Error {
  readonly field?: string;
  readonly rule?: string;
  readonly retryAfter?: number;

  constructor(
    readonly status: number,
    message: string,
    readonly body: ApiErrorBody | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
    this.field = body?.field;
    this.rule = body?.rule;
    this.retryAfter = body?.retryAfter;
  }
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

/** Registers the function called on any 401 except from /auth/login, /auth/me and /auth/logout. */
export function onUnauthorized(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

const UNAUTHORIZED_EXEMPT = ['/auth/login', '/auth/me', '/auth/logout'];

function isExempt(path: string): boolean {
  const pathname = path.split(/[?#]/)[0];
  return UNAUTHORIZED_EXEMPT.includes(pathname ?? '');
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/** An error body whose `message` is a string or a list of strings; anything else is ignored. */
function asErrorBody(parsed: unknown): ApiErrorBody | null {
  if (!parsed || typeof parsed !== 'object' || !('message' in parsed)) return null;
  const { message } = parsed;
  const valid =
    typeof message === 'string' ||
    (Array.isArray(message) && message.every((m) => typeof m === 'string'));
  return valid ? (parsed as ApiErrorBody) : null;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    [CSRF_HEADER]: CSRF_HEADER_VALUE,
  };
  const init: RequestInit = { method, headers, credentials: 'same-origin' };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const response = await fetch(`/${API_PREFIX}${path}`, init);

  if (!response.ok) {
    const errorBody = asErrorBody(await readJson(response));
    const message = errorBody
      ? Array.isArray(errorBody.message)
        ? errorBody.message.join('\n')
        : errorBody.message
      : `${method} ${path} failed with status ${response.status}`;
    if (response.status === 401 && !isExempt(path)) unauthorizedHandler?.();
    throw new ApiError(response.status, message, errorBody);
  }

  if (response.status === 204) return undefined as T;
  try {
    return (await response.json()) as T;
  } catch {
    // E.g. an HTML page from a proxy: callers handle ApiError, not SyntaxError.
    throw new ApiError(response.status, `${method} ${path} returned an invalid response`);
  }
}

/** GET a JSON resource from the API on the same origin, e.g. apiGet('/health'). */
export function apiGet<T>(path: string): Promise<T> {
  return request<T>('GET', path);
}

export function apiPost<T = void>(path: string, body?: unknown): Promise<T> {
  return request<T>('POST', path, body);
}

export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return request<T>('PATCH', path, body);
}

export function apiDelete(path: string): Promise<void> {
  return request<void>('DELETE', path);
}
