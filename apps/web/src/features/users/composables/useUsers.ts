import type { CreateUserRequest, Page, UpdateUserRequest, UserDto } from '@offwise/shared';
import { reactive, ref } from 'vue';
import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';

export interface UsersQuery {
  search: string;
  includeClosed: boolean;
  page: number;
}

/** Every failure becomes an ApiError; network failures (no response) get status 0. */
function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError(0, error instanceof Error ? error.message : String(error));
}

async function mapped<T>(request: Promise<T>): Promise<T> {
  try {
    return await request;
  } catch (error) {
    throw toApiError(error);
  }
}

function listPath(query: UsersQuery): string {
  const params = new URLSearchParams();
  const search = query.search.trim();
  if (search) params.set('search', search);
  if (query.includeClosed) params.set('includeClosed', 'true');
  params.set('page', String(query.page));
  return `/users?${params.toString()}`;
}

const userPath = (id: string) => `/users/${encodeURIComponent(id)}`;

/** The admin user list and user mutations. Debouncing the search is up to the caller. */
export function useUsers() {
  const page = ref<Page<UserDto> | null>(null);
  const loading = ref(false);
  const error = ref<ApiError | null>(null);
  const query = reactive<UsersQuery>({ search: '', includeClosed: false, page: 1 });

  let latest = 0;

  async function fetch(): Promise<void> {
    const request = ++latest;
    loading.value = true;
    try {
      const result = await apiGet<Page<UserDto>>(listPath(query));
      if (request !== latest) return;
      page.value = result;
      error.value = null;
    } catch (e) {
      if (request !== latest) return;
      error.value = toApiError(e);
    } finally {
      if (request === latest) loading.value = false;
    }
  }

  return {
    page,
    loading,
    error,
    query,
    fetch,
    getUser: (id: string) => mapped(apiGet<UserDto>(userPath(id))),
    createUser: (body: CreateUserRequest) => mapped(apiPost<UserDto>('/users', body)),
    updateUser: (id: string, body: UpdateUserRequest) =>
      mapped(apiPatch<UserDto>(userPath(id), body)),
    closeUser: (id: string) => mapped(apiDelete(userPath(id))),
  };
}
