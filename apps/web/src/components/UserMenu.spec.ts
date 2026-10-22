import type { CurrentUser } from '@offwise/shared';
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { i18n } from '@/i18n';
import UserMenu from './UserMenu.vue';

const user: CurrentUser = {
  id: 'u1',
  name: 'Grace Hopper',
  email: 'grace@example.com',
  role: 'employee',
  locale: 'en-GB',
  timeZone: 'UTC',
};

const render = () =>
  mount(UserMenu, { props: { user }, global: { plugins: [i18n] }, attachTo: document.body });

async function open(wrapper: ReturnType<typeof render>) {
  await wrapper.get('button').trigger('keydown', { key: 'Enter' });
  await flushPromises();
}

const menuItem = (text: string) =>
  Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
    (item) => item.textContent?.trim() === text,
  );

afterEach(() => {
  document.body.innerHTML = '';
});

describe('UserMenu', () => {
  it('labels the trigger with the user name', () => {
    const wrapper = render();
    expect(wrapper.get('button').attributes('aria-label')).toBe('Account menu for Grace Hopper');
  });

  it('shows the name and email when opened', async () => {
    const wrapper = render();
    await open(wrapper);
    const menu = document.body.querySelector('[role="menu"]');
    expect(menu?.textContent).toContain('Grace Hopper');
    expect(menu?.textContent).toContain('grace@example.com');
  });

  it('emits signOut when "Sign out" is chosen', async () => {
    const wrapper = render();
    await open(wrapper);
    menuItem('Sign out')?.click();
    await flushPromises();
    expect(wrapper.emitted('signOut')).toHaveLength(1);
  });
});
