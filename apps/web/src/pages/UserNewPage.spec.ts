import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

import { ApiError, apiPost } from '@/lib/api';
import { resetSessionForTests } from '@/features/auth/composables/useSession';
import UserNewPage from './UserNewPage.vue';
import { grace, mountPage, signInAsAdmin } from './page-test-utils';

beforeEach(async () => {
  vi.clearAllMocks();
  resetSessionForTests();
  await signInAsAdmin();
});

enableAutoUnmount(afterEach);

async function fillAndSubmit(wrapper: Awaited<ReturnType<typeof mountPage>>['wrapper']) {
  await wrapper.get('input[name="name"]').setValue('Grace Hopper');
  await wrapper.get('input[name="email"]').setValue('grace@example.com');
  await wrapper.get('form').trigger('submit');
  await flushPromises();
}

describe('UserNewPage', () => {
  it('creates the user and opens its edit page with a success note', async () => {
    const { wrapper, router } = await mountPage(UserNewPage, '/admin/users/new');
    expect(wrapper.get('h1').text()).toBe('New user');
    vi.mocked(apiPost).mockResolvedValueOnce(grace);
    await fillAndSubmit(wrapper);
    expect(apiPost).toHaveBeenLastCalledWith('/users', {
      name: 'Grace Hopper',
      email: 'grace@example.com',
      role: 'employee',
      locale: null,
      timeZone: null,
    });
    expect(router.currentRoute.value.path).toBe('/admin/users/u2');
    expect(router.currentRoute.value.query).toEqual({ created: '1' });
  });

  it('shows a duplicate email under the email field', async () => {
    const { wrapper, router } = await mountPage(UserNewPage, '/admin/users/new');
    vi.mocked(apiPost).mockRejectedValueOnce(
      new ApiError(409, 'x', { statusCode: 409, message: 'x', field: 'email' }),
    );
    await fillAndSubmit(wrapper);
    const email = wrapper.get('input[name="email"]');
    expect(wrapper.get(`#${email.attributes('aria-describedby')}`).text()).toBe(
      'Another user already has this email.',
    );
    expect(router.currentRoute.value.path).toBe('/admin/users/new');
  });

  it('goes back to the list on cancel', async () => {
    const { wrapper, router } = await mountPage(UserNewPage, '/admin/users/new');
    await wrapper.get('button[data-action="cancel"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('users');
  });
});
