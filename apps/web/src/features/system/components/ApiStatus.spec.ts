import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { i18n } from '@/i18n';
import ApiStatus from './ApiStatus.vue';

const render = (state: 'loading' | 'ok' | 'error') =>
  mount(ApiStatus, { props: { state }, global: { plugins: [i18n] } });

describe('ApiStatus', () => {
  it.each([
    ['loading', 'Checking API…'],
    ['ok', 'API connected'],
    ['error', 'API unavailable'],
  ] as const)('shows the %s message as a status', (state, text) => {
    const wrapper = render(state);
    expect(wrapper.get('[role="status"]').text()).toBe(text);
  });

  it('switches colours instantly, so the badge is never caught mid-fade as grey on grey', () => {
    // Badge has `transition-all`; animating from the light secondary to the dark primary
    // variant passes through a low-contrast grey on grey.
    const badge = render('ok').get('[data-slot="badge"]');
    expect(badge.classes()).toContain('transition-none');
    expect(badge.classes()).not.toContain('transition-all');
  });
});
