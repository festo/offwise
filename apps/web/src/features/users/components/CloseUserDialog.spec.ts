import type { UserDto } from '@offwise/shared';
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { i18n } from '@/i18n';
import CloseUserDialog from './CloseUserDialog.vue';

const grace: UserDto = {
  id: 'u2',
  name: 'Grace Hopper',
  email: 'grace@example.com',
  role: 'employee',
  locale: null,
  timeZone: null,
  hasPassword: true,
  createdAt: '2026-10-01T00:00:00.000Z',
  closedAt: null,
};

async function render(props: { open?: boolean; pending?: boolean; error?: string | null } = {}) {
  const wrapper = mount(CloseUserDialog, {
    props: { open: true, user: grace, ...props },
    global: { plugins: [i18n] },
    attachTo: document.body,
  });
  await flushPromises();
  return wrapper;
}

const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]');
const button = (label: string) =>
  [...(dialog()?.querySelectorAll('button') ?? [])].find((b) => b.textContent?.trim() === label);

afterEach(() => {
  document.body.innerHTML = '';
});

describe('CloseUserDialog', () => {
  it('names the user and explains the consequence', async () => {
    await render();
    expect(dialog()!.textContent).toContain("Close Grace Hopper's account?");
    expect(dialog()!.textContent).toContain('cannot be reopened');
  });

  it('renders nothing when closed', async () => {
    await render({ open: false });
    expect(dialog()).toBeNull();
  });

  it('emits confirm from the destructive button', async () => {
    const wrapper = await render();
    const confirm = button('Close account')!;
    expect(confirm.dataset.variant).toBe('destructive');
    confirm.click();
    await flushPromises();
    expect(wrapper.emitted('confirm')).toHaveLength(1);
  });

  it('emits update:open false on cancel', async () => {
    const wrapper = await render();
    button('Cancel')!.click();
    await flushPromises();
    expect(wrapper.emitted('update:open')).toEqual([[false]]);
    expect(wrapper.emitted('confirm')).toBeUndefined();
  });

  it('disables the buttons and does not confirm while pending', async () => {
    const wrapper = await render({ pending: true });
    const confirm = button('Closing…')!;
    expect(confirm.disabled).toBe(true);
    expect(button('Cancel')!.disabled).toBe(true);
    confirm.click();
    await flushPromises();
    expect(wrapper.emitted('confirm')).toBeUndefined();
  });

  it('shows an error in an alert', async () => {
    await render({ error: 'This is the last active admin.' });
    expect(dialog()!.querySelector('[role="alert"]')!.textContent).toContain('last active admin');
  });
});
