import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Input } from '@/components/ui/input';
import { Label } from '.';

const meta = {
  title: 'UI/Label',
  component: Label,
  render: () => ({
    components: { Label },
    template: '<Label>Email</Label>',
  }),
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithInput: Story = {
  render: () => ({
    components: { Label, Input },
    template: `<div class="grid w-72 gap-2">
      <Label for="story-email">Email</Label>
      <Input id="story-email" type="email" />
    </div>`,
  }),
};
export const Disabled: Story = {
  render: () => ({
    components: { Label, Input },
    template: `<div class="group grid w-72 gap-2" data-disabled="true">
      <Label for="story-email-disabled">Email</Label>
      <Input id="story-email-disabled" type="email" disabled class="peer" />
    </div>`,
  }),
};
