import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';
import ResetPasswordForm from './ResetPasswordForm.vue';

const meta = {
  title: 'Auth/ResetPasswordForm',
  component: ResetPasswordForm,
  args: { onSubmit: fn() },
  render: (args) => ({
    components: { ResetPasswordForm },
    setup: () => ({ args }),
    template: '<div class="w-[22rem] max-w-full"><ResetPasswordForm v-bind="args" /></div>',
  }),
} satisfies Meta<typeof ResetPasswordForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Pending: Story = { args: { pending: true } };
export const WithError: Story = { args: { error: 'This link is invalid or has expired.' } };
export const TokenMissing: Story = { args: { tokenMissing: true } };
export const Mobile: Story = {
  globals: { viewport: { value: 'mobile', isRotated: false } },
};
