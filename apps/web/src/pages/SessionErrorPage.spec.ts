import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { i18n } from '@/i18n';
import SessionErrorPage from './SessionErrorPage.vue';

const stub = { template: '<div />' };

async function mountPage(url: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: stub },
      { path: '/admin/users', name: 'users', component: stub },
      { path: '/error', name: 'session-error', component: SessionErrorPage },
    ],
  });
  await router.push(url);
  await router.isReady();
  const wrapper = mount(SessionErrorPage, { global: { plugins: [i18n, router] } });
  return { wrapper, router };
}

describe('SessionErrorPage', () => {
  it('explains the problem and offers a retry', async () => {
    const { wrapper } = await mountPage('/error?redirect=/admin/users');
    expect(wrapper.get('h1').text()).toBe('offwise is not available right now');
    expect(wrapper.get('[role="alert"]').text()).toBe(
      'We could not reach the server. Check your connection and try again.',
    );
    expect(wrapper.get('button').text()).toBe('Retry');
  });

  it('retries by navigating back to the page that failed', async () => {
    const { wrapper, router } = await mountPage('/error?redirect=/admin/users%3Fx%3D1');
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe('/admin/users?x=1');
  });

  it('only retries inside the app', async () => {
    const { wrapper, router } = await mountPage('/error?redirect=//evil.example');
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe('/');
  });
});
