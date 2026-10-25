import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Separator } from '.';

const meta = {
  title: 'UI/Separator',
  component: Separator,
  args: { orientation: 'horizontal' },
  render: (args) => ({
    components: { Separator },
    setup: () => ({ args }),
    template: `<div :class="args.orientation === 'vertical' ? 'flex h-6 items-center gap-4' : 'w-72 space-y-4'">
      <span>Home</span><Separator v-bind="args" /><span>Users</span>
    </div>`,
  }),
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {};
export const Vertical: Story = { args: { orientation: 'vertical' } };
