import type { Page, UserDto } from '@offwise/shared';
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

import { ApiError, apiGet, apiPost } from '@/lib/api';
import { resetSessionForTests, useSession } from '@/features/auth/composables/useSession';
import UsersPage from './UsersPage.vue';
import { grace, mountPage, signInAsAdmin } from './page-test-utils';

const pageOf = (items: UserDto[], page = 1, total = items.length): Page<UserDto> => ({
  items,
  total,
  page,
  pageSize: 25,
});
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(async () => {
  vi.clearAllMocks();
  resetSessionForTests();
  await signInAsAdmin();
  vi.mocked(apiGet).mockResolvedValue(pageOf([grace]));
});

enableAutoUnmount(afterEach);

async function render(url = '/admin/users') {
  const result = await mountPage(UsersPage, url);
  await flushPromises();
  return result;
}

describe('UsersPage', () => {
  it('loads the first page and lists users', async () => {
    const { wrapper } = await render();
    expect(apiGet).toHaveBeenCalledWith('/users?page=1');
    expect(wrapper.get('h1').text()).toBe('Users');
    expect(wrapper.text()).toContain('Grace Hopper');
  });

  it('restores search, closed toggle and page from the URL', async () => {
    const { wrapper } = await render('/admin/users?search=gr&includeClosed=true&page=2');
    expect(apiGet).toHaveBeenCalledWith('/users?search=gr&includeClosed=true&page=2');
    expect((wrapper.get('input[type="search"]').element as HTMLInputElement).value).toBe('gr');
    expect(wrapper.get('[role="switch"]').attributes('aria-checked')).toBe('true');
  });

  it('debounces the search, resets to page 1 and mirrors it in the URL', async () => {
    const { wrapper, router } = await render('/admin/users?page=2');
    vi.mocked(apiGet).mockClear();
    await wrapper.get('input[type="search"]').setValue('g');
    await wrapper.get('input[type="search"]').setValue('gra');
    await wait(100);
    expect(apiGet).not.toHaveBeenCalled();
    await wait(300);
    await flushPromises();
    expect(apiGet).toHaveBeenCalledTimes(1);
    expect(apiGet).toHaveBeenCalledWith('/users?search=gra&page=1');
    expect(router.currentRoute.value.query).toEqual({ search: 'gra' });
  });

  it('keeps a trailing space typed into the search after the debounce', async () => {
    const { wrapper, router } = await render();
    await wrapper.get('input[type="search"]').setValue('ada ');
    await wait(400);
    await flushPromises();
    expect(router.currentRoute.value.query).toEqual({ search: 'ada' });
    expect((wrapper.get('input[type="search"]').element as HTMLInputElement).value).toBe('ada ');
  });

  it('keeps just-typed search text when the switch is toggled within the debounce', async () => {
    const { wrapper, router } = await render();
    await wrapper.get('input[type="search"]').setValue('gra');
    await wrapper.get('[role="switch"]').trigger('click');
    await flushPromises();
    expect((wrapper.get('input[type="search"]').element as HTMLInputElement).value).toBe('gra');
    expect(router.currentRoute.value.query).toEqual({ search: 'gra', includeClosed: 'true' });
    expect(apiGet).toHaveBeenLastCalledWith('/users?search=gra&includeClosed=true&page=1');
    await wait(400);
    await flushPromises();
    expect(apiGet).toHaveBeenLastCalledWith('/users?search=gra&includeClosed=true&page=1');
  });

  it('clamps an out-of-range page to the last page', async () => {
    vi.mocked(apiGet).mockImplementation(async (path: string) =>
      path.endsWith('page=9') ? pageOf([], 9, 30) : pageOf([grace], 2, 30),
    );
    const { wrapper, router } = await render('/admin/users?page=9');
    await flushPromises();
    expect(router.currentRoute.value.query).toEqual({ page: '2' });
    expect(apiGet).toHaveBeenLastCalledWith('/users?page=2');
    expect(wrapper.text()).toContain('Grace Hopper');
  });

  it('clamps an out-of-range page to page 1 when there are no results', async () => {
    vi.mocked(apiGet).mockImplementation(async (path: string) =>
      path.endsWith('page=3') ? pageOf([], 3, 0) : pageOf([], 1, 0),
    );
    const { router } = await render('/admin/users?search=zz&page=3');
    await flushPromises();
    expect(router.currentRoute.value.query).toEqual({ search: 'zz' });
    expect(apiGet).toHaveBeenLastCalledWith('/users?search=zz&page=1');
  });

  it('toggles closed users and mirrors it in the URL', async () => {
    const { wrapper, router } = await render();
    await wrapper.get('[role="switch"]').trigger('click');
    await flushPromises();
    expect(apiGet).toHaveBeenLastCalledWith('/users?includeClosed=true&page=1');
    expect(router.currentRoute.value.query).toEqual({ includeClosed: 'true' });
  });

  it('labels the search and the switch', async () => {
    const { wrapper } = await render();
    const search = wrapper.get('input[type="search"]');
    expect(wrapper.get(`label[for="${search.attributes('id')}"]`).text()).toBe('Search users');
    const toggle = wrapper.get('[role="switch"]');
    expect(wrapper.get(`label[for="${toggle.attributes('id')}"]`).text()).toBe('Show closed');
  });

  it('gives the Show closed label a 44 px tap target that toggles the switch', async () => {
    const { wrapper, router } = await render();
    const toggle = wrapper.get('[role="switch"]');
    const label = wrapper.get(`label[for="${toggle.attributes('id')}"]`);
    expect(label.classes()).toEqual(expect.arrayContaining(['min-h-11', 'inline-flex']));
    await label.trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.query).toEqual({ includeClosed: 'true' });
  });

  it('changes page from the pagination', async () => {
    vi.mocked(apiGet).mockResolvedValue(pageOf([grace], 1, 60));
    const { wrapper, router } = await render();
    await wrapper.get('button[aria-label="Next page"]').trigger('click');
    await flushPromises();
    expect(apiGet).toHaveBeenLastCalledWith('/users?page=2');
    expect(router.currentRoute.value.query).toEqual({ page: '2' });
  });

  it('opens a user on select', async () => {
    const { wrapper, router } = await render();
    await wrapper.findComponent({ name: 'UserTable' }).vm.$emit('select', 'u2');
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe('/admin/users/u2');
  });

  it('links to the create page', async () => {
    const { wrapper } = await render();
    expect(wrapper.get('a[href="/admin/users/new"]').text()).toContain('Add user');
  });

  it('shows an error with a retry when the list fails', async () => {
    vi.mocked(apiGet).mockRejectedValueOnce(new ApiError(500, 'boom', null));
    const { wrapper } = await render();
    expect(wrapper.get('[role="alert"]').text()).toContain('Could not load users.');
    vi.mocked(apiGet).mockResolvedValue(pageOf([grace]));
    await wrapper.get('[role="alert"] button').trigger('click');
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('Grace Hopper');
  });

  it('signs out even when logout fails', async () => {
    const { wrapper, router } = await render();
    vi.mocked(apiPost).mockRejectedValueOnce(new ApiError(500, 'x', null));
    await wrapper.findComponent({ name: 'AppLayout' }).vm.$emit('signOut');
    await flushPromises();
    expect(useSession().user.value).toBeNull();
    expect(router.currentRoute.value.name).toBe('login');
  });
});
