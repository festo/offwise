import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { i18n } from '@/i18n';
import AuthLayout from './AuthLayout.vue';

describe('AuthLayout', () => {
  it('renders the title as the page heading, the description and the slots', () => {
    const wrapper = mount(AuthLayout, {
      props: { title: 'Sign in', description: 'Use your work email.' },
      slots: { default: '<form>the form</form>', footer: '<a href="/forgot">Forgot?</a>' },
      global: { plugins: [i18n] },
    });

    expect(wrapper.get('h1').text()).toBe('Sign in');
    expect(wrapper.text()).toContain('Use your work email.');
    expect(wrapper.get('form').text()).toBe('the form');
    expect(wrapper.get('a[href="/forgot"]').text()).toBe('Forgot?');
  });

  it('shows the app name in the page', () => {
    const wrapper = mount(AuthLayout, {
      props: { title: 'Sign in' },
      global: { plugins: [i18n] },
    });

    expect(wrapper.text()).toContain('offwise');
  });
});
