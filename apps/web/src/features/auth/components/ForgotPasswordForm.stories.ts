import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';
import ForgotPasswordForm from './ForgotPasswordForm.vue';

const meta = {
  title: 'Auth/ForgotPasswordForm',
  component: ForgotPasswordForm,
  args: { onSubmit: fn() },
  render: (args) => ({
    components: { ForgotPasswordForm },
    setup: () => ({ args }),
    template: '<div class="w-[22rem] max-w-full"><ForgotPasswordForm v-bind="args" /></div>',
  }),
} satisfies Meta<typeof ForgotPasswordForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Pending: Story = { args: { pending: true } };
export const WithError: Story = { args: { error: 'Too many attempts. Try again later.' } };
export const Sent: Story = { args: { sent: true } };
export const Mobile: Story = {
  globals: { viewport: { value: 'mobile', isRotated: false } },
};
