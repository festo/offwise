import type { UserDto } from '@offwise/shared';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';
import CloseUserDialog from './CloseUserDialog.vue';

const grace: UserDto = {
  id: '00000000-0000-0000-0000-000000000003',
  name: 'Grace Hopper',
  email: 'grace@example.com',
  role: 'employee',
  locale: null,
  timeZone: null,
  hasPassword: true,
  createdAt: '2026-10-01T09:00:00.000Z',
  closedAt: null,
};

const meta = {
  title: 'Users/CloseUserDialog',
  component: CloseUserDialog,
  args: { open: true, user: grace, onConfirm: fn(), 'onUpdate:open': fn() },
} satisfies Meta<typeof CloseUserDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};
export const Pending: Story = { args: { pending: true } };
export const WithError: Story = {
  args: { error: 'This is the last active admin. Make another user an admin first.' },
};
export const Mobile: Story = {
  globals: { viewport: { value: 'mobile', isRotated: false } },
};
