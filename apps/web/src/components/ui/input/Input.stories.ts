import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Input } from '.';

const meta = {
  title: 'UI/Input',
  component: Input,
  render: (args) => ({
    components: { Input },
    setup: () => ({ args }),
    template: '<Input v-bind="args" aria-label="Email" class="w-72" />',
  }),
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Placeholder: Story = {
  render: () => ({
    components: { Input },
    template: '<Input aria-label="Email" placeholder="you@example.com" class="w-72" />',
  }),
};
export const WithValue: Story = { args: { defaultValue: 'ada@example.com' } };
export const Invalid: Story = {
  render: () => ({
    components: { Input },
    template:
      '<Input aria-label="Email" aria-invalid="true" model-value="not-an-email" class="w-72" />',
  }),
};
export const Disabled: Story = {
  render: () => ({
    components: { Input },
    template: '<Input aria-label="Email" disabled model-value="ada@example.com" class="w-72" />',
  }),
};
