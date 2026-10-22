import type { CurrentUser } from '@offwise/shared';
import { computed, readonly, ref } from 'vue';
import { setLocaleFromTag } from '@/i18n';
import { ApiError, apiGet, apiPost } from '@/lib/api';

// Module-level state: every caller sees the same session (no Pinia).
const user = ref<CurrentUser | null>(null);
const loaded = ref(false);
let loading: Promise<void> | null = null;

function setUser(next: CurrentUser): void {
  user.value = next;
  loaded.value = true;
  setLocaleFromTag(next.locale);
}

async function load(): Promise<void> {
  if (loaded.value) return;
  loading ??= (async () => {
    try {
      setUser(await apiGet<CurrentUser>('/auth/me'));
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      user.value = null;
      loaded.value = true;
    } finally {
      loading = null;
    }
  })();
  return loading;
}

async function login(email: string, password: string): Promise<void> {
  setUser(await apiPost<CurrentUser>('/auth/login', { email, password }));
}

async function logout(): Promise<void> {
  try {
    await apiPost('/auth/logout');
  } catch (error) {
    // An already-expired session is as good as logged out.
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
  }
  clear();
}

/** Forgets the signed-in user locally (after logout or a 401). */
function clear(): void {
  user.value = null;
}

const isAdmin = computed(() => user.value?.role === 'admin');

export function useSession() {
  return { user: readonly(user), loaded: readonly(loaded), isAdmin, load, login, logout, clear };
}

/** Test helper: back to the state of a fresh page load. */
export function resetSessionForTests(): void {
  user.value = null;
  loaded.value = false;
  loading = null;
}
