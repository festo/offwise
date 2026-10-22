import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { i18n } from '@/i18n';
import ForgotPasswordForm from './ForgotPasswordForm.vue';

const render = (props = {}) =>
  mount(ForgotPasswordForm, {
    props,
    global: {
      plugins: [i18n],
      stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } },
    },
  });

describe('ForgotPasswordForm', () => {
  it('has a labelled email input', () => {
    const w = render();
    const email = w.get('input[type="email"]');
    expect(email.attributes('autocomplete')).toBe('email');
    expect(w.get(`label[for="${email.attributes('id')}"]`).text()).toBe('Email');
  });

  it('emits the trimmed email', async () => {
    const w = render();
    await w.get('input').setValue(' ada@example.com ');
    await w.get('form').trigger('submit');
    expect(w.emitted('submit')).toEqual([[{ email: 'ada@example.com' }]]);
  });

  it('does not emit with an empty email and shows a field error', async () => {
    const w = render();
    await w.get('form').trigger('submit');
    expect(w.emitted('submit')).toBeUndefined();
    const email = w.get('input[type="email"]');
    expect(email.attributes('aria-invalid')).toBe('true');
    expect(w.get(`#${email.attributes('aria-describedby')}`).text()).toBe('Enter your email.');
  });

  it('does not emit while pending', async () => {
    const w = render({ pending: true });
    await w.get('input').setValue('a@b.c');
    await w.get('form').trigger('submit');
    expect(w.emitted('submit')).toBeUndefined();
  });

  it('shows the error in an alert region', () => {
    expect(render({ error: 'Too many' }).get('[role="alert"]').text()).toBe('Too many');
  });

  it('shows the generic confirmation instead of the form when sent', () => {
    const w = render({ sent: true });
    expect(w.find('form').exists()).toBe(false);
    expect(w.get('[role="status"]').text()).toContain('If an account exists');
    expect(w.find('a[href="/login"]').exists()).toBe(true);
  });
});
