import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Skeleton } from '.';

const meta = {
  title: 'UI/Skeleton',
  component: Skeleton,
  render: () => ({
    components: { Skeleton },
    template: '<Skeleton class="h-4 w-48" />',
  }),
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Card: Story = {
  render: () => ({
    components: { Skeleton },
    template: `<div class="flex items-center gap-4">
      <Skeleton class="size-10 rounded-full" />
      <div class="space-y-2"><Skeleton class="h-4 w-48" /><Skeleton class="h-4 w-32" /></div>
    </div>`,
  }),
};
