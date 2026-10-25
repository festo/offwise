import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

import { i18n } from '@/i18n';
import { ApiError, apiGet, apiPost } from '@/lib/api';
import { resetSessionForTests, useSession } from '@/features/auth/composables/useSession';
import HomePage from './HomePage.vue';

const user = {
  id: 'u',
  name: 'Ada',
  email: 'ada@example.com',
  role: 'employee',
  locale: 'en-GB',
  timeZone: 'UTC',
};

async function mountPage() {
  vi.mocked(apiPost).mockResolvedValueOnce(user);
  await useSession().login('ada@example.com', 'pw');
  vi.mocked(apiGet).mockResolvedValue({ status: 'ok', db: 'up' });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: HomePage },
      { path: '/login', name: 'login', component: { template: '<div />' } },
    ],
  });
  await router.push('/');
  await router.isReady();
  const wrapper = mount(HomePage, { global: { plugins: [i18n, router] } });
  await flushPromises();
  return { wrapper, router };
}

async function signOut(wrapper: Awaited<ReturnType<typeof mountPage>>['wrapper']) {
  await wrapper.findComponent({ name: 'AppLayout' }).vm.$emit('signOut');
  await flushPromises();
}

beforeEach(() => {
  vi.clearAllMocks();
  resetSessionForTests();
});

describe('HomePage', () => {
  it('welcomes the user', async () => {
    const { wrapper } = await mountPage();
    expect(wrapper.get('h1').text()).toBe('Welcome, Ada');
  });

  it('signs out and goes to the login page', async () => {
    const { wrapper, router } = await mountPage();
    vi.mocked(apiPost).mockResolvedValueOnce(undefined);
    await signOut(wrapper);
    expect(apiPost).toHaveBeenLastCalledWith('/auth/logout');
    expect(useSession().user.value).toBeNull();
    expect(router.currentRoute.value.name).toBe('login');
  });

  it('still clears the session and goes to login when logout fails', async () => {
    const { wrapper, router } = await mountPage();
    vi.mocked(apiPost).mockRejectedValueOnce(new ApiError(500, 'boom', null));
    await signOut(wrapper);
    expect(useSession().user.value).toBeNull();
    expect(router.currentRoute.value.name).toBe('login');
  });

  it('still signs out when the network is down', async () => {
    const { wrapper, router } = await mountPage();
    vi.mocked(apiPost).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await signOut(wrapper);
    expect(useSession().user.value).toBeNull();
    expect(router.currentRoute.value.name).toBe('login');
  });
});
