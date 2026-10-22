import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import type { CurrentUser } from '@offwise/shared';
import { installGuards, safeRedirect } from './guards';

const Stub = { template: '<div />' };

function setup(user: Partial<CurrentUser> | null, loadError?: unknown) {
  const userRef = ref(user as CurrentUser | null);
  const loaded = ref(false);
  const session = {
    user: userRef,
    loaded,
    isAdmin: {
      get value() {
        return userRef.value?.role === 'admin';
      },
    },
    load: vi.fn(async () => {
      if (loadError) throw loadError;
      loaded.value = true;
    }),
  };
  const router: Router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: Stub, meta: { public: true, guestOnly: true } },
      {
        path: '/forgot-password',
        name: 'forgot-password',
        component: Stub,
        meta: { public: true },
      },
      { path: '/error', name: 'session-error', component: Stub, meta: { public: true } },
      { path: '/', name: 'home', component: Stub },
      { path: '/admin/users', name: 'users', component: Stub, meta: { admin: true } },
    ],
  });
  installGuards(router, session as never);
  return { router, session };
}

describe('installGuards', () => {
  it('loads the session once before the first navigation', async () => {
    const { router, session } = setup({ role: 'employee' });
    await router.push('/');
    await router.push('/admin/users');
    expect(session.load).toHaveBeenCalledTimes(1);
  });

  it('sends signed-out users to login with the redirect', async () => {
    const { router } = setup(null);
    await router.push('/admin/users?x=1');
    expect(router.currentRoute.value.name).toBe('login');
    expect(router.currentRoute.value.query.redirect).toBe('/admin/users?x=1');
  });

  it('lets signed-out users see public pages', async () => {
    const { router } = setup(null);
    await router.push('/forgot-password');
    expect(router.currentRoute.value.name).toBe('forgot-password');
  });

  it('redirects signed-in users away from guest-only pages', async () => {
    const { router } = setup({ role: 'employee' });
    await router.push('/login');
    expect(router.currentRoute.value.name).toBe('home');
  });

  it('sends non-admins away from admin routes', async () => {
    const { router } = setup({ role: 'employee' });
    await router.push('/admin/users');
    expect(router.currentRoute.value.name).toBe('home');
  });

  it('lets admins into admin routes', async () => {
    const { router } = setup({ role: 'admin' });
    await router.push('/admin/users');
    expect(router.currentRoute.value.name).toBe('users');
  });
});

describe('installGuards when the session cannot be loaded', () => {
  const failures = [
    ['a 500', new Error('GET /auth/me failed with status 500')],
    ['a network error', new TypeError('Failed to fetch')],
  ] as const;

  it.each(failures)('lets public pages render signed out on %s', async (_, error) => {
    const { router } = setup(null, error);
    await router.push('/forgot-password');
    expect(router.currentRoute.value.name).toBe('forgot-password');
    await router.push('/login');
    expect(router.currentRoute.value.name).toBe('login');
  });

  it.each(failures)('shows the error page for protected routes on %s', async (_, error) => {
    const { router } = setup(null, error);
    await router.push('/admin/users?x=1');
    expect(router.currentRoute.value.name).toBe('session-error');
    expect(router.currentRoute.value.query.redirect).toBe('/admin/users?x=1');
  });

  it('retries the load on the next navigation and continues once it succeeds', async () => {
    const { router, session } = setup({ role: 'admin' }, new Error('boom'));
    await router.push('/admin/users');
    expect(router.currentRoute.value.name).toBe('session-error');

    session.load.mockImplementation(async () => {
      session.loaded.value = true;
    });
    await router.push(router.currentRoute.value.query.redirect as string);
    expect(router.currentRoute.value.name).toBe('users');
  });
});

describe('safeRedirect', () => {
  it.each([
    ['//evil.com', '/'],
    ['https://evil.com', '/'],
    ['/\\evil.com', '/'],
    ['/\t/evil.com', '/'],
    ['/\n/evil.com', '/'],
    [undefined, '/'],
    [['/a'], '/'],
    ['/admin/users?x=1', '/admin/users?x=1'],
  ])('%s -> %s', (input, expected) => {
    expect(safeRedirect(input)).toBe(expected);
  });
});
