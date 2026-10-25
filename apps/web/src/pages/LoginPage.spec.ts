import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

import { i18n } from '@/i18n';
import { ApiError, apiPost } from '@/lib/api';
import { resetSessionForTests } from '@/features/auth/composables/useSession';
import LoginPage from './LoginPage.vue';

const stub = { template: '<div />' };
const user = {
  id: 'u',
  name: 'Ada',
  email: 'a@b.c',
  role: 'employee',
  locale: 'en-GB',
  timeZone: 'UTC',
};

async function mountAt(url: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: LoginPage },
      { path: '/', name: 'home', component: stub },
      { path: '/forgot-password', component: stub },
      { path: '/admin/users', component: stub },
    ],
  });
  await router.push(url);
  await router.isReady();
  const wrapper = mount(LoginPage, { global: { plugins: [i18n, router] } });
  return { wrapper, router };
}

async function submit(wrapper: Awaited<ReturnType<typeof mountAt>>['wrapper']) {
  await wrapper.get('input[type="email"]').setValue('a@b.c');
  await wrapper.get('input[type="password"]').setValue('pw');
  await wrapper.get('form').trigger('submit');
  await flushPromises();
}

beforeEach(() => {
  vi.clearAllMocks();
  resetSessionForTests();
});

describe('LoginPage', () => {
  it('signs in and follows a safe redirect', async () => {
    vi.mocked(apiPost).mockResolvedValue(user);
    const { wrapper, router } = await mountAt('/login?redirect=/admin/users');
    await submit(wrapper);
    expect(apiPost).toHaveBeenCalledWith('/auth/login', { email: 'a@b.c', password: 'pw' });
    expect(router.currentRoute.value.path).toBe('/admin/users');
  });

  it('ignores an unsafe redirect', async () => {
    vi.mocked(apiPost).mockResolvedValue(user);
    const { wrapper, router } = await mountAt('/login?redirect=//evil.com');
    await submit(wrapper);
    expect(router.currentRoute.value.path).toBe('/');
  });

  it('shows the invalid-credentials message on 401', async () => {
    vi.mocked(apiPost).mockRejectedValue(new ApiError(401, 'x', null));
    const { wrapper } = await mountAt('/login');
    await submit(wrapper);
    expect(wrapper.get('[role="alert"]').text()).toBe('Invalid email or password.');
  });

  it('shows the throttle message on 429', async () => {
    vi.mocked(apiPost).mockRejectedValue(new ApiError(429, 'x', null));
    const { wrapper } = await mountAt('/login');
    await submit(wrapper);
    expect(wrapper.get('[role="alert"]').text()).toContain('Too many attempts');
  });

  it('rounds retryAfter up to whole minutes, with plural forms', async () => {
    vi.mocked(apiPost).mockRejectedValue(
      new ApiError(429, 'x', { statusCode: 429, message: 'x', retryAfter: 90 }),
    );
    const { wrapper } = await mountAt('/login');
    await submit(wrapper);
    expect(wrapper.get('[role="alert"]').text()).toBe('Too many attempts. Try again in 2 minutes.');
  });

  it('uses the singular for one minute', async () => {
    vi.mocked(apiPost).mockRejectedValue(
      new ApiError(429, 'x', { statusCode: 429, message: 'x', retryAfter: 60 }),
    );
    const { wrapper } = await mountAt('/login');
    await submit(wrapper);
    expect(wrapper.get('[role="alert"]').text()).toBe('Too many attempts. Try again in 1 minute.');
  });

  it('shows a note after a password reset', async () => {
    const { wrapper } = await mountAt('/login?reset=1');
    expect(wrapper.get('[role="status"]').text()).toContain('password has been changed');
  });
});
