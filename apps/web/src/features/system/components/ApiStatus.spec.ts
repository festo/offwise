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
});
