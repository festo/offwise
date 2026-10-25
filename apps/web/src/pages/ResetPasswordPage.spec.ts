import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  apiPost: vi.fn(),
}));

import { i18n } from '@/i18n';
import { ApiError, apiPost } from '@/lib/api';
import ResetPasswordPage from './ResetPasswordPage.vue';

const stub = { template: '<div />' };

function mountPage(hash: string) {
  window.history.replaceState(null, '', `/reset-password${hash}`);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: stub },
      { path: '/login', name: 'login', component: stub },
      { path: '/forgot-password', component: stub },
    ],
  });
  const wrapper = mount(ResetPasswordPage, { global: { plugins: [i18n, router] } });
  return { wrapper, router };
}

async function submit(wrapper: ReturnType<typeof mountPage>['wrapper']) {
  const inputs = wrapper.findAll('input[type="password"]');
  await inputs[0]!.setValue('correct horse battery');
  await inputs[1]!.setValue('correct horse battery');
  await wrapper.get('form').trigger('submit');
  await flushPromises();
}

beforeEach(() => vi.clearAllMocks());

describe('ResetPasswordPage', () => {
  it('removes the token from the URL and posts it with the password', async () => {
    vi.mocked(apiPost).mockResolvedValue(undefined);
    const { wrapper, router } = mountPage('#token=abc_123');
    expect(window.location.hash).toBe('');
    await submit(wrapper);
    expect(apiPost).toHaveBeenCalledWith('/auth/password-reset/confirm', {
      token: 'abc_123',
      password: 'correct horse battery',
    });
    expect(router.currentRoute.value.name).toBe('login');
    expect(router.currentRoute.value.query).toEqual({ reset: '1' });
  });

  it('shows the invalid-link message without a token', () => {
    const { wrapper } = mountPage('');
    expect(wrapper.find('form').exists()).toBe(false);
    expect(wrapper.get('[role="alert"]').text()).toContain('invalid');
  });

  it('shows an error on a rejected token', async () => {
    vi.mocked(apiPost).mockRejectedValue(new ApiError(400, 'x', null));
    const { wrapper } = mountPage('#token=bad');
    await submit(wrapper);
    expect(wrapper.get('[role="alert"]').text()).toContain('invalid or has expired');
  });

  it('shows the throttle message with retryAfter on 429', async () => {
    vi.mocked(apiPost).mockRejectedValue(
      new ApiError(429, 'x', { statusCode: 429, message: 'x', retryAfter: 120 }),
    );
    const { wrapper } = mountPage('#token=t');
    await submit(wrapper);
    expect(wrapper.get('[role="alert"]').text()).toBe('Too many attempts. Try again in 2 minutes.');
  });
});
