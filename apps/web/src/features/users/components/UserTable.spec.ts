import type { UserDto } from '@offwise/shared';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { i18n } from '@/i18n';
import UserTable from './UserTable.vue';

const ada: UserDto = {
  id: 'u1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  role: 'admin',
  locale: null,
  timeZone: null,
  hasPassword: true,
  createdAt: '2026-10-01T00:00:00.000Z',
  closedAt: null,
};
const grace: UserDto = {
  ...ada,
  id: 'u2',
  name: 'Grace Hopper',
  email: 'grace@example.com',
  role: 'employee',
  hasPassword: false,
  closedAt: '2026-10-10T00:00:00.000Z',
};

const stub = { template: '<div />' };
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: stub },
    { path: '/admin/users/:id', name: 'user-edit', component: stub },
  ],
});

const render = (props: Partial<InstanceType<typeof UserTable>['$props']> = {}) =>
  mount(UserTable, {
    props: { users: [ada, grace], total: 2, page: 1, pageSize: 25, ...props },
    global: { plugins: [i18n, router] },
  });

describe('UserTable', () => {
  it('renders names, emails and translated roles in the table', () => {
    const w = render();
    const rows = w.findAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0]!.text()).toContain('Ada Lovelace');
    expect(rows[0]!.text()).toContain('ada@example.com');
    expect(rows[0]!.text()).toContain('Admin');
    expect(rows[1]!.text()).toContain('Employee');
  });

  it('renders a card per user for phones', () => {
    const cards = render().findAll('li button');
    expect(cards).toHaveLength(2);
    expect(cards[1]!.text()).toContain('Grace Hopper');
    expect(cards[1]!.text()).toContain('grace@example.com');
  });

  it('shows a Closed badge and Password not set only where they apply', () => {
    const rows = render().findAll('tbody tr');
    expect(rows[0]!.text()).not.toContain('Closed');
    expect(rows[0]!.text()).not.toContain('Password not set');
    expect(rows[1]!.find('[data-slot="badge"]').text()).toBe('Closed');
    expect(rows[1]!.text()).toContain('Password not set');
  });

  it('exposes each table row as a link named after the user, for keyboard and screen readers', () => {
    const rows = render().findAll('tbody tr');
    const link = rows[1]!.get('a');
    expect(link.attributes('href')).toBe('/admin/users/u2');
    expect(link.text()).toBe('Grace Hopper');
    // The link is the single tab stop of the row; the row itself is not focusable.
    expect(rows[1]!.attributes('tabindex')).toBeUndefined();
  });

  it('emits select when a row is clicked outside the link, and not twice via the link', async () => {
    const w = render();
    const rows = w.findAll('tbody tr');
    await rows[0]!.findAll('td')[1]!.trigger('click');
    await rows[1]!.get('a').trigger('click');
    expect(w.emitted('select')).toEqual([['u1']]);
  });

  it('emits select when a card is clicked', async () => {
    const w = render();
    await w.findAll('li button')[1]!.trigger('click');
    expect(w.emitted('select')).toEqual([['u2']]);
  });

  it('shows the page position and emits page on next and previous', async () => {
    const w = render({ total: 60, page: 2, pageSize: 25 });
    expect(w.text()).toContain('Page 2 of 3');
    await w.get('button[aria-label="Next page"]').trigger('click');
    await w.get('button[aria-label="Previous page"]').trigger('click');
    expect(w.emitted('page')).toEqual([[3], [1]]);
  });

  it('disables previous on the first page and next on the last', () => {
    const first = render({ total: 60, page: 1 });
    expect(first.get('button[aria-label="Previous page"]').attributes('disabled')).toBeDefined();
    expect(first.get('button[aria-label="Next page"]').attributes('disabled')).toBeUndefined();
    const last = render({ total: 60, page: 3 });
    expect(last.get('button[aria-label="Next page"]').attributes('disabled')).toBeDefined();
  });

  it('shows an empty state without users', () => {
    const w = render({ users: [], total: 0 });
    expect(w.text()).toContain('No users found.');
    expect(w.find('tbody tr td').text()).toContain('No users found.');
  });

  it('shows skeletons and no empty state while loading', () => {
    const w = render({ users: [], total: 0, loading: true });
    expect(w.findAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(w.text()).not.toContain('No users found.');
    expect(w.find('[aria-busy="true"]').exists()).toBe(true);
  });
});
