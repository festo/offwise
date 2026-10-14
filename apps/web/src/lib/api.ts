import { API_PREFIX } from '@offwise/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** GET a JSON resource from the API on the same origin, e.g. apiGet('/health'). */
export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`/${API_PREFIX}${path}`, {
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
  });
  if (!response.ok) {
    throw new ApiError(response.status, `GET ${path} failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}
