import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { i18n } from '@/i18n';
import LoginForm from './LoginForm.vue';

const render = (props = {}) =>
  mount(LoginForm, {
    props,
    global: {
      plugins: [i18n],
      stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } },
    },
  });

describe('LoginForm', () => {
  it('labels its inputs with the right types and autocomplete', () => {
    const w = render();
    const email = w.get('input[type="email"]');
    const password = w.get('input[type="password"]');
    expect(email.attributes('autocomplete')).toBe('email');
    expect(password.attributes('autocomplete')).toBe('current-password');
    expect(w.get(`label[for="${email.attributes('id')}"]`).text()).toBe('Email');
    expect(w.get(`label[for="${password.attributes('id')}"]`).text()).toBe('Password');
  });

  it('emits trimmed email and the password as typed', async () => {
    const w = render();
    await w.get('input[type="email"]').setValue('  ada@example.com ');
    await w.get('input[type="password"]').setValue('secret pass');
    await w.get('form').trigger('submit');
    expect(w.emitted('submit')).toEqual([[{ email: 'ada@example.com', password: 'secret pass' }]]);
  });

  it('does not emit with an empty email and shows a field error', async () => {
    const w = render();
    await w.get('input[type="email"]').setValue('   ');
    await w.get('input[type="password"]').setValue('secret pass');
    await w.get('form').trigger('submit');
    expect(w.emitted('submit')).toBeUndefined();
    const email = w.get('input[type="email"]');
    expect(email.attributes('aria-invalid')).toBe('true');
    const errorId = email.attributes('aria-describedby');
    expect(w.get(`#${errorId}`).text()).toBe('Enter your email.');
  });

  it('does not emit while pending', async () => {
    const w = render({ pending: true });
    await w.get('input[type="email"]').setValue('a@b.c');
    await w.get('input[type="password"]').setValue('x');
    await w.get('form').trigger('submit');
    expect(w.emitted('submit')).toBeUndefined();
    expect(w.get('button[type="submit"]').attributes('disabled')).toBeDefined();
  });

  it('shows the error in an alert region', () => {
    const w = render({ error: 'Invalid email or password' });
    expect(w.get('[role="alert"]').text()).toBe('Invalid email or password');
  });

  it('links to forgot password', () => {
    expect(render().get('a[href="/forgot-password"]').text()).toBe('Forgot your password?');
  });
});
