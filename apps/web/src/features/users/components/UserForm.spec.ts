import type { UserDto } from '@offwise/shared';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { i18n } from '@/i18n';
import UserForm from './UserForm.vue';

const ada: UserDto = {
  id: 'u1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  role: 'admin',
  locale: 'en-GB',
  timeZone: 'Europe/London',
  hasPassword: true,
  createdAt: '2026-10-01T00:00:00.000Z',
  closedAt: null,
};

type Props = InstanceType<typeof UserForm>['$props'];
const render = (props: Partial<Props> = {}) =>
  mount(UserForm, {
    props: { mode: 'create', ...props } as Props,
    global: { plugins: [i18n] },
    attachTo: document.body,
  });

const field = (w: ReturnType<typeof render>, name: string) => w.get(`input[name="${name}"]`);

describe('UserForm', () => {
  it('labels every field', () => {
    const w = render();
    for (const [name, label] of [
      ['name', 'Name'],
      ['email', 'Email'],
      ['locale', 'Locale'],
      ['timeZone', 'Time zone'],
    ] as const) {
      const id = field(w, name).attributes('id');
      expect(w.get(`label[for="${id}"]`).text()).toBe(label);
    }
    const role = w.get('[role="combobox"]');
    expect(w.get(`label[for="${role.attributes('id')}"]`).text()).toBe('Role');
  });

  it('uses 16 px inputs, a locale placeholder and a time zone datalist', () => {
    const w = render();
    expect(field(w, 'locale').attributes('placeholder')).toBe('en-GB');
    const listId = field(w, 'timeZone').attributes('list');
    expect(listId).toBeTruthy();
    const options = w.findAll(`datalist[id="${listId}"] option`);
    expect(options.map((o) => o.attributes('value'))).toContain('Europe/London');
    expect(field(w, 'name').classes()).toContain('text-base');
  });

  it('emits a create request with trimmed values and null for empty locale and time zone', async () => {
    const w = render();
    await field(w, 'name').setValue('  Grace Hopper ');
    await field(w, 'email').setValue(' grace@example.com ');
    await field(w, 'locale').setValue('   ');
    await w.get('form').trigger('submit');
    expect(w.emitted('submit')).toEqual([
      [
        {
          name: 'Grace Hopper',
          email: 'grace@example.com',
          role: 'employee',
          locale: null,
          timeZone: null,
        },
      ],
    ]);
  });

  it('includes a locale and time zone when given', async () => {
    const w = render();
    await field(w, 'name').setValue('Grace');
    await field(w, 'email').setValue('grace@example.com');
    await field(w, 'locale').setValue('hu-HU');
    await field(w, 'timeZone').setValue('Europe/Budapest');
    await w.get('form').trigger('submit');
    expect(w.emitted('submit')![0]![0]).toMatchObject({
      locale: 'hu-HU',
      timeZone: 'Europe/Budapest',
    });
  });

  it('prefills the initial user in edit mode', () => {
    const w = render({ mode: 'edit', initial: ada });
    expect((field(w, 'name').element as HTMLInputElement).value).toBe('Ada Lovelace');
    expect((field(w, 'email').element as HTMLInputElement).value).toBe('ada@example.com');
    expect((field(w, 'locale').element as HTMLInputElement).value).toBe('en-GB');
    expect((field(w, 'timeZone').element as HTMLInputElement).value).toBe('Europe/London');
    expect(w.get('[role="combobox"]').text()).toContain('Admin');
    expect(w.get('button[type="submit"]').text()).toBe('Save changes');
  });

  it('emits only the changed fields in edit mode', async () => {
    const w = render({ mode: 'edit', initial: ada });
    await field(w, 'name').setValue('Ada King');
    await w.get('form').trigger('submit');
    expect(w.emitted('submit')).toEqual([[{ name: 'Ada King' }]]);
  });

  it('emits null when an existing locale or time zone is cleared', async () => {
    const w = render({ mode: 'edit', initial: ada });
    await field(w, 'locale').setValue('');
    await field(w, 'timeZone').setValue(' ');
    await w.get('form').trigger('submit');
    expect(w.emitted('submit')).toEqual([[{ locale: null, timeZone: null }]]);
  });

  it('does not emit an edit without changes', async () => {
    const w = render({ mode: 'edit', initial: ada });
    await field(w, 'name').setValue(' Ada Lovelace ');
    await w.get('form').trigger('submit');
    expect(w.emitted('submit')).toBeUndefined();
    expect(w.get('[role="status"]').text()).toBe('Nothing to save.');
  });

  it('requires a name and an email', async () => {
    const w = render();
    await w.get('form').trigger('submit');
    expect(w.emitted('submit')).toBeUndefined();
    const name = field(w, 'name');
    expect(name.attributes('aria-invalid')).toBe('true');
    expect(w.get(`#${name.attributes('aria-describedby')}`).text()).toBe('Enter a name.');
    const email = field(w, 'email');
    expect(w.get(`#${email.attributes('aria-describedby')}`).text()).toBe('Enter an email.');
  });

  it('shows a server field error under the email field', () => {
    const w = render({
      errors: { field: 'email', message: 'Another user already has this email.' },
    });
    const email = field(w, 'email');
    expect(email.attributes('aria-invalid')).toBe('true');
    expect(w.get(`#${email.attributes('aria-describedby')}`).text()).toBe(
      'Another user already has this email.',
    );
    expect(w.find('[role="alert"]').exists()).toBe(false);
  });

  it('clears a server field error once that field changes, but not on other fields', async () => {
    const w = render({
      errors: { field: 'email', message: 'Another user already has this email.' },
    });
    await field(w, 'name').setValue('Grace');
    expect(field(w, 'email').attributes('aria-invalid')).toBe('true');
    await field(w, 'email').setValue('grace@example.com');
    expect(field(w, 'email').attributes('aria-invalid')).toBeUndefined();
    expect(field(w, 'email').attributes('aria-describedby')).toBeUndefined();
    expect(w.text()).not.toContain('Another user already has this email.');
  });

  it('shows a new server field error again after it was cleared', async () => {
    const w = render({ errors: { field: 'email', message: 'Taken.' } });
    await field(w, 'email').setValue('other@example.com');
    expect(w.text()).not.toContain('Taken.');
    await w.setProps({ errors: { field: 'email', message: 'Taken.' } });
    expect(w.text()).toContain('Taken.');
  });

  it('offers UTC first in the time zone datalist', () => {
    const w = render();
    const listId = field(w, 'timeZone').attributes('list');
    const values = w.findAll(`datalist[id="${listId}"] option`).map((o) => o.attributes('value'));
    expect(values[0]).toBe('UTC');
    expect(values.filter((v) => v === 'UTC')).toHaveLength(1);
  });

  it('shows the last-admin rule as a form-level alert', () => {
    const w = render({ mode: 'edit', initial: ada, errors: { rule: 'last-admin' } });
    expect(w.get('[role="alert"]').text()).toContain('no active admin');
  });

  it('shows other errors as a form-level alert', () => {
    const w = render({ errors: { message: 'Something went wrong. Try again.' } });
    expect(w.get('[role="alert"]').text()).toBe('Something went wrong. Try again.');
  });

  it('does not emit while pending and disables the submit button', async () => {
    const w = render({ pending: true });
    await field(w, 'name').setValue('Grace');
    await field(w, 'email').setValue('grace@example.com');
    await w.get('form').trigger('submit');
    expect(w.emitted('submit')).toBeUndefined();
    expect(w.get('button[type="submit"]').attributes('disabled')).toBeDefined();
    expect(w.get('button[type="submit"]').text()).toBe('Creating…');
  });

  it('emits cancel', async () => {
    const w = render();
    await w.get('button[type="button"][data-action="cancel"]').trigger('click');
    expect(w.emitted('cancel')).toHaveLength(1);
  });
});
