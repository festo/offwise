import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Switch } from '.';

const meta = {
  title: 'UI/Switch',
  component: Switch,
  args: { size: 'default', defaultValue: false, disabled: false },
  render: (args) => ({
    components: { Switch },
    setup: () => ({ args }),
    template: `<label class="flex items-center gap-2 text-sm">
      <Switch v-bind="args" /> Show closed users
    </label>`,
  }),
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Checked: Story = { args: { defaultValue: true } };
export const Small: Story = { args: { size: 'sm' } };
export const Disabled: Story = { args: { disabled: true } };
