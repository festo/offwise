import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Plus } from '@lucide/vue';
import { Button } from '.';

const meta = {
  title: 'UI/Button',
  component: Button,
  args: { variant: 'default', size: 'default' },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'outline', 'secondary', 'ghost', 'destructive', 'link'],
    },
    size: {
      control: 'select',
      options: ['default', 'xs', 'sm', 'lg', 'icon', 'icon-xs', 'icon-sm', 'icon-lg'],
    },
  },
  render: (args) => ({
    components: { Button, Plus },
    setup: () => ({ args }),
    template: `<Button v-bind="args">
      <Plus v-if="String(args.size).startsWith('icon')" /><span :class="String(args.size).startsWith('icon') ? 'sr-only' : ''">Button</span>
    </Button>`,
  }),
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Outline: Story = { args: { variant: 'outline' } };
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Ghost: Story = { args: { variant: 'ghost' } };
export const Destructive: Story = { args: { variant: 'destructive' } };
export const Link: Story = { args: { variant: 'link' } };
export const SizeXs: Story = { args: { size: 'xs' } };
export const SizeSm: Story = { args: { size: 'sm' } };
export const SizeLg: Story = { args: { size: 'lg' } };
export const Icon: Story = { args: { size: 'icon' } };
export const IconXs: Story = { args: { size: 'icon-xs' } };
export const IconSm: Story = { args: { size: 'icon-sm' } };
export const IconLg: Story = { args: { size: 'icon-lg' } };
export const Disabled: Story = {
  render: () => ({
    components: { Button },
    template: '<Button disabled>Button</Button>',
  }),
};
