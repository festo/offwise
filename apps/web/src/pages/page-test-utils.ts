// Test helpers for page specs. Specs must mock `@/lib/api` (apiPost at least) before using them.
import type { CurrentUser, UserDto } from '@offwise/shared';
import { mount } from '@vue/test-utils';
import { vi } from 'vitest';
import type { Component } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { i18n } from '@/i18n';
import { apiPost } from '@/lib/api';
import { useSession } from '@/features/auth/composables/useSession';

export const adminUser: CurrentUser = {
  id: 'admin-1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  role: 'admin',
  locale: 'en-GB',
  timeZone: 'UTC',
};

export const grace: UserDto = {
  id: 'u2',
  name: 'Grace Hopper',
  email: 'grace@example.com',
  role: 'employee',
  locale: null,
  timeZone: null,
  hasPassword: true,
  createdAt: '2026-10-01T00:00:00.000Z',
  closedAt: null,
};

/** Signs in through the mocked API so `useSession().user` is set. */
export async function signInAsAdmin(): Promise<void> {
  vi.mocked(apiPost).mockResolvedValueOnce(adminUser);
  await useSession().login(adminUser.email, 'pw');
}

const stub = { template: '<div />' };

/** Mounts `page` at `url` inside a memory router that knows the app's admin routes. */
export async function mountPage(page: Component, url: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: stub },
      { path: '/login', name: 'login', component: stub },
      { path: '/admin/users', name: 'users', component: page },
      { path: '/admin/users/new', name: 'user-new', component: page },
      { path: '/admin/users/:id', name: 'user-edit', component: page },
    ],
  });
  await router.push(url);
  await router.isReady();
  const wrapper = mount(page, { global: { plugins: [i18n, router] }, attachTo: document.body });
  return { wrapper, router };
}
