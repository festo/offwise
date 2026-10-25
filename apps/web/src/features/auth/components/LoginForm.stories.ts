import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';
import LoginForm from './LoginForm.vue';

const meta = {
  title: 'Auth/LoginForm',
  component: LoginForm,
  args: { onSubmit: fn() },
  render: (args) => ({
    components: { LoginForm },
    setup: () => ({ args }),
    template: '<div class="w-[22rem] max-w-full"><LoginForm v-bind="args" /></div>',
  }),
} satisfies Meta<typeof LoginForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Pending: Story = { args: { pending: true } };
export const WithError: Story = { args: { error: 'Invalid email or password.' } };
export const Mobile: Story = {
  globals: { viewport: { value: 'mobile', isRotated: false } },
};
