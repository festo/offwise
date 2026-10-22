import type { CurrentUser } from '@offwise/shared';
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { i18n } from '@/i18n';
import AppLayout from './AppLayout.vue';

const employee: CurrentUser = {
  id: 'u1',
  name: 'Grace Hopper',
  email: 'grace@example.com',
  role: 'employee',
  locale: 'en-GB',
  timeZone: 'UTC',
};
const admin: CurrentUser = { ...employee, id: 'u2', name: 'Ada Lovelace', role: 'admin' };

async function render(user: CurrentUser, path = '/') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<p>home</p>' } },
      { path: '/admin/users', name: 'users', component: { template: '<p>users</p>' } },
      { path: '/admin/users/:id', name: 'user-edit', component: { template: '<p>user</p>' } },
    ],
  });
  await router.push(path);
  await router.isReady();
  const wrapper = mount(AppLayout, {
    props: { user },
    slots: { default: '<p>page content</p>' },
    global: { plugins: [i18n, router] },
    attachTo: document.body,
  });
  await flushPromises();
  return wrapper;
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

function stubMobileViewport() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

describe('AppLayout', () => {
  it('renders the page in the main landmark', async () => {
    const wrapper = await render(employee);
    expect(wrapper.get('main').text()).toContain('page content');
  });

  it('links to Home and hides Users from non-admins', async () => {
    const wrapper = await render(employee);
    const nav = wrapper.get('nav');
    expect(nav.find('a[href="/"]').text()).toBe('Home');
    expect(nav.find('a[href="/admin/users"]').exists()).toBe(false);
  });

  it('shows Users to admins', async () => {
    const wrapper = await render(admin);
    expect(wrapper.get('nav').get('a[href="/admin/users"]').text()).toBe('Users');
  });

  it('has a navigation toggle in the top bar', async () => {
    const wrapper = await render(employee);
    const toggle = wrapper.get('header').get('button[data-sidebar="trigger"]');
    expect(toggle.text()).toBe('Toggle navigation');
  });

  it('emits signOut when the user menu signs out', async () => {
    const wrapper = await render(employee);
    await wrapper.findComponent({ name: 'UserMenu' }).vm.$emit('signOut');
    expect(wrapper.emitted('signOut')).toHaveLength(1);
  });

  it('marks Home as the current page on /', async () => {
    const wrapper = await render(admin, '/');
    const nav = wrapper.get('nav');
    expect(nav.get('a[href="/"]').attributes('aria-current')).toBe('page');
    expect(nav.get('a[href="/"]').attributes('data-active')).toBeDefined();
    expect(nav.get('a[href="/admin/users"]').attributes('aria-current')).toBeUndefined();
  });

  it('marks Users as current on a user detail page', async () => {
    const wrapper = await render(admin, '/admin/users/123');
    const nav = wrapper.get('nav');
    expect(nav.get('a[href="/admin/users"]').attributes('aria-current')).toBe('page');
    expect(nav.get('a[href="/admin/users"]').attributes('data-active')).toBeDefined();
    expect(nav.get('a[href="/"]').attributes('aria-current')).toBeUndefined();
    expect(nav.get('a[href="/"]').attributes('data-active')).toBeUndefined();
  });

  it('labels the toggle with translated screen-reader text', async () => {
    const wrapper = await render(employee);
    const toggle = wrapper.get('header').get('[data-sidebar="trigger"]');
    expect(toggle.get('.sr-only').text()).toBe('Toggle navigation');
    expect(wrapper.html()).not.toContain('Toggle Sidebar');
  });

  it('gives the off-canvas navigation a translated title on phones', async () => {
    stubMobileViewport();
    const wrapper = await render(employee);
    await wrapper.get('header').get('[data-sidebar="trigger"]').trigger('click');
    await flushPromises();
    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.textContent).toContain('Navigation');
    expect(dialog!.textContent).toContain('Links to the pages of offwise.');
    expect(dialog!.textContent).not.toContain('Displays the mobile sidebar.');
  });
});
