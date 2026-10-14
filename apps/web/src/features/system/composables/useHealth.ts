import type { HealthResponse } from '@offwise/shared';
import { readonly, ref } from 'vue';
import { apiGet } from '@/lib/api';
import type { HealthState } from '../types';

export function useHealth() {
  const state = ref<HealthState>('loading');

  async function refresh(): Promise<void> {
    state.value = 'loading';
    try {
      const health = await apiGet<HealthResponse>('/health');
      state.value = health.status === 'ok' ? 'ok' : 'error';
    } catch {
      state.value = 'error';
    }
  }

  return { state: readonly(state), refresh };
}
