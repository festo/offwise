import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { i18n } from '@/i18n';
import ResetPasswordForm from './ResetPasswordForm.vue';

const render = (props = {}) =>
  mount(ResetPasswordForm, {
    props,
    global: {
      plugins: [i18n],
      stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } },
    },
  });

async function fill(w: ReturnType<typeof render>, password: string, confirm: string) {
  const inputs = w.findAll('input[type="password"]');
  await inputs[0]!.setValue(password);
  await inputs[1]!.setValue(confirm);
  await w.get('form').trigger('submit');
}

describe('ResetPasswordForm', () => {
  it('has two labelled new-password fields', () => {
    const w = render();
    const inputs = w.findAll('input[type="password"]');
    expect(inputs).toHaveLength(2);
    for (const input of inputs) {
      expect(input.attributes('autocomplete')).toBe('new-password');
      expect(w.find(`label[for="${input.attributes('id')}"]`).exists()).toBe(true);
    }
  });

  it('emits the password when valid and matching', async () => {
    const w = render();
    await fill(w, 'correct horse battery', 'correct horse battery');
    expect(w.emitted('submit')).toEqual([[{ password: 'correct horse battery' }]]);
  });

  it('rejects a short password without emitting', async () => {
    const w = render();
    await fill(w, 'short', 'short');
    expect(w.emitted('submit')).toBeUndefined();
    expect(w.get('[role="alert"]').text()).toContain('12');
  });

  it('rejects a password over 128 characters', async () => {
    const w = render();
    const long = 'a'.repeat(129);
    await fill(w, long, long);
    expect(w.emitted('submit')).toBeUndefined();
    expect(w.find('[role="alert"]').exists()).toBe(true);
  });

  it('rejects mismatched passwords without emitting', async () => {
    const w = render();
    await fill(w, 'correct horse battery', 'correct horse batterX');
    expect(w.emitted('submit')).toBeUndefined();
    expect(w.get('[role="alert"]').text()).toContain('do not match');
  });

  it('does not emit while pending', async () => {
    const w = render({ pending: true });
    await fill(w, 'correct horse battery', 'correct horse battery');
    expect(w.emitted('submit')).toBeUndefined();
  });

  it('shows the server error in an alert region', () => {
    expect(render({ error: 'Link expired' }).get('[role="alert"]').text()).toBe('Link expired');
  });

  it('shows an invalid-link message with a link to request a new one', () => {
    const w = render({ tokenMissing: true });
    expect(w.find('form').exists()).toBe(false);
    expect(w.get('[role="alert"]').text()).toContain('invalid');
    expect(w.find('a[href="/forgot-password"]').exists()).toBe(true);
  });
});
