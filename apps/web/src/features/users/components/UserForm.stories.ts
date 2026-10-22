import type { UserDto } from '@offwise/shared';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';
import UserForm from './UserForm.vue';

const ada: UserDto = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  role: 'admin',
  locale: 'en-GB',
  timeZone: 'Europe/London',
  hasPassword: true,
  createdAt: '2026-10-01T09:00:00.000Z',
  closedAt: null,
};

const meta = {
  title: 'Users/UserForm',
  component: UserForm,
  args: { mode: 'create', onSubmit: fn(), onCancel: fn() },
  render: (args) => ({
    components: { UserForm },
    setup: () => ({ args }),
    template: '<div class="w-[calc(100vw-2rem)] max-w-[32rem]"><UserForm v-bind="args" /></div>',
  }),
} satisfies Meta<typeof UserForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Create: Story = {};
export const Edit: Story = { args: { mode: 'edit', initial: ada } };
export const Pending: Story = { args: { mode: 'edit', initial: ada, pending: true } };
export const EmailConflict: Story = {
  args: {
    mode: 'edit',
    initial: ada,
    errors: { field: 'email', message: 'Another user already has this email.' },
  },
};
export const LastAdmin: Story = {
  args: { mode: 'edit', initial: ada, errors: { rule: 'last-admin' } },
};
export const Mobile: Story = {
  args: { mode: 'edit', initial: ada },
  globals: { viewport: { value: 'mobile', isRotated: false } },
};
