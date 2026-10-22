import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));

import { ApiError, apiDelete, apiGet, apiPatch } from '@/lib/api';
import { resetSessionForTests } from '@/features/auth/composables/useSession';
import UserEditPage from './UserEditPage.vue';
import { grace, mountPage, signInAsAdmin } from './page-test-utils';

beforeEach(async () => {
  vi.clearAllMocks();
  resetSessionForTests();
  await signInAsAdmin();
  vi.mocked(apiGet).mockResolvedValue(grace);
});

enableAutoUnmount(afterEach);

async function render(url = '/admin/users/u2') {
  const result = await mountPage(UserEditPage, url);
  await flushPromises();
  return result;
}

const dialogButton = (label: string) =>
  [...document.body.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
    (b) => b.textContent?.trim() === label,
  );

describe('UserEditPage', () => {
  it('loads the user into the form', async () => {
    const { wrapper } = await render();
    expect(apiGet).toHaveBeenCalledWith('/users/u2');
    expect(wrapper.get('h1').text()).toBe('Grace Hopper');
    expect((wrapper.get('input[name="email"]').element as HTMLInputElement).value).toBe(
      'grace@example.com',
    );
  });

  it('shows the created note after creating', async () => {
    const { wrapper } = await render('/admin/users/u2?created=1');
    expect(wrapper.get('[role="status"]').text()).toContain('User created.');
  });

  it('saves only the changed fields and confirms', async () => {
    const { wrapper } = await render();
    vi.mocked(apiPatch).mockResolvedValueOnce({ ...grace, name: 'Grace B. Hopper' });
    await wrapper.get('input[name="name"]').setValue('Grace B. Hopper');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(apiPatch).toHaveBeenCalledWith('/users/u2', { name: 'Grace B. Hopper' });
    expect(wrapper.get('h1').text()).toBe('Grace B. Hopper');
    expect(wrapper.get('[role="status"]').text()).toBe('Changes saved.');
  });

  it('shows the last-admin rule as an alert', async () => {
    const { wrapper } = await render();
    vi.mocked(apiPatch).mockRejectedValueOnce(
      new ApiError(409, 'x', { statusCode: 409, message: 'x', rule: 'last-admin' }),
    );
    await wrapper.get('input[name="name"]').setValue('Someone');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('no active admin');
  });

  it('shows not found for an unknown user', async () => {
    vi.mocked(apiGet).mockRejectedValueOnce(new ApiError(404, 'x', null));
    const { wrapper } = await render();
    expect(wrapper.get('[role="alert"]').text()).toBe('This user does not exist.');
    expect(wrapper.find('form').exists()).toBe(false);
  });

  it('closes the account after confirmation and returns to the list', async () => {
    const { wrapper, router } = await render();
    vi.mocked(apiDelete).mockResolvedValueOnce(undefined);
    const close = wrapper.findAll('button').find((b) => b.text() === 'Close account')!;
    await close.trigger('click');
    await flushPromises();
    dialogButton('Close account')!.click();
    await flushPromises();
    expect(apiDelete).toHaveBeenCalledWith('/users/u2');
    expect(router.currentRoute.value.name).toBe('users');
  });

  it('keeps the dialog open with the last-admin message when closing is refused', async () => {
    const { wrapper, router } = await render();
    vi.mocked(apiDelete).mockRejectedValueOnce(
      new ApiError(409, 'x', { statusCode: 409, message: 'x', rule: 'last-admin' }),
    );
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Close account')!
      .trigger('click');
    await flushPromises();
    dialogButton('Close account')!.click();
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('user-edit');
    expect(document.body.querySelector('[role="dialog"] [role="alert"]')!.textContent).toContain(
      'last active admin',
    );
  });

  it('ignores a stale user response that arrives after switching users', async () => {
    let resolveFirst!: (value: typeof grace) => void;
    vi.mocked(apiGet).mockReturnValueOnce(new Promise((r) => (resolveFirst = r)));
    const { wrapper, router } = await mountPage(UserEditPage, '/admin/users/u2');
    vi.mocked(apiGet).mockResolvedValueOnce({ ...grace, id: 'u3', name: 'Alan Turing' });
    await router.push('/admin/users/u3');
    await flushPromises();
    expect(wrapper.get('h1').text()).toBe('Alan Turing');
    resolveFirst(grace);
    await flushPromises();
    expect(wrapper.get('h1').text()).toBe('Alan Turing');
  });

  it('reloads the user when closing finds it already closed elsewhere (404)', async () => {
    const { wrapper } = await render();
    vi.mocked(apiDelete).mockRejectedValueOnce(new ApiError(404, 'x', null));
    vi.mocked(apiGet).mockResolvedValue({ ...grace, closedAt: '2026-10-10T00:00:00.000Z' });
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Close account')!
      .trigger('click');
    await flushPromises();
    dialogButton('Close account')!.click();
    await flushPromises();
    expect(apiGet).toHaveBeenCalledTimes(2);
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(wrapper.text()).toContain('This account is closed.');
    expect(wrapper.text()).not.toContain('Something went wrong');
  });

  it('hides Close account for closed users and says the account is closed', async () => {
    vi.mocked(apiGet).mockResolvedValue({ ...grace, closedAt: '2026-10-10T00:00:00.000Z' });
    const { wrapper } = await render();
    expect(wrapper.findAll('button').some((b) => b.text() === 'Close account')).toBe(false);
    expect(wrapper.text()).toContain('This account is closed.');
  });
});
