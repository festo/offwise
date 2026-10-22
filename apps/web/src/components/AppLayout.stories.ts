import type { CurrentUser } from '@offwise/shared';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import AppLayout from './AppLayout.vue';

const employee: CurrentUser = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Grace Hopper',
  email: 'grace@example.com',
  role: 'employee',
  locale: 'en-GB',
  timeZone: 'UTC',
};

const meta = {
  title: 'Layout/AppLayout',
  component: AppLayout,
  parameters: { layout: 'fullscreen' },
  args: { user: employee, onSignOut: fn() },
  render: (args) => ({
    components: { AppLayout },
    setup: () => ({ args }),
    template: `<AppLayout v-bind="args">
      <h1 class="text-2xl font-semibold">Page title</h1>
      <p class="mt-2 text-muted-foreground">Page content goes here.</p>
    </AppLayout>`,
  }),
} satisfies Meta<typeof AppLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Admin: Story = {
  args: { user: { ...employee, name: 'Ada Lovelace', email: 'ada@example.com', role: 'admin' } },
};
export const Mobile: Story = {
  globals: { viewport: { value: 'mobile', isRotated: false } },
};

/** Phone width with the off-canvas navigation opened from the top bar. */
export const MobileOpen: Story = {
  globals: { viewport: { value: 'mobile', isRotated: false } },
  args: { user: { ...employee, name: 'Ada Lovelace', email: 'ada@example.com', role: 'admin' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Toggle navigation' }));
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole('dialog', { name: 'Navigation' });
    await expect(within(dialog).getByRole('link', { name: 'Users' })).toBeVisible();
  },
};
