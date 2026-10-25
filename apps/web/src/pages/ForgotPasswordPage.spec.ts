import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  apiPost: vi.fn(),
}));

import { i18n } from '@/i18n';
import { ApiError, apiPost } from '@/lib/api';
import ForgotPasswordPage from './ForgotPasswordPage.vue';

const stub = { template: '<div />' };

async function mountPage() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/forgot-password', component: ForgotPasswordPage },
      { path: '/login', name: 'login', component: stub },
    ],
  });
  await router.push('/forgot-password');
  await router.isReady();
  return mount(ForgotPasswordPage, { global: { plugins: [i18n, router] } });
}

async function submit(wrapper: Awaited<ReturnType<typeof mountPage>>) {
  await wrapper.get('input[type="email"]').setValue('ada@example.com');
  await wrapper.get('form').trigger('submit');
  await flushPromises();
}

beforeEach(() => vi.clearAllMocks());

describe('ForgotPasswordPage', () => {
  it('posts the email and shows the generic confirmation', async () => {
    vi.mocked(apiPost).mockResolvedValue(undefined);
    const wrapper = await mountPage();
    await submit(wrapper);
    expect(apiPost).toHaveBeenCalledWith('/auth/password-reset', { email: 'ada@example.com' });
    expect(wrapper.find('form').exists()).toBe(false);
    expect(wrapper.get('[role="status"]').text()).toContain('If an account exists');
  });

  it('shows the throttle message with retryAfter on 429', async () => {
    vi.mocked(apiPost).mockRejectedValue(
      new ApiError(429, 'x', { statusCode: 429, message: 'x', retryAfter: 90 }),
    );
    const wrapper = await mountPage();
    await submit(wrapper);
    expect(wrapper.get('[role="alert"]').text()).toBe('Too many attempts. Try again in 2 minutes.');
  });

  it('shows a generic error on other failures', async () => {
    vi.mocked(apiPost).mockRejectedValue(new ApiError(500, 'x', null));
    const wrapper = await mountPage();
    await submit(wrapper);
    expect(wrapper.get('[role="alert"]').text()).toBe('Something went wrong. Try again.');
    expect(wrapper.find('form').exists()).toBe(true);
  });
});
