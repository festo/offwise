import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Avatar, AvatarBadge, AvatarFallback, AvatarGroup, AvatarGroupCount } from '.';

const meta = {
  title: 'UI/Avatar',
  component: Avatar,
  args: { size: 'default' },
  render: (args) => ({
    components: { Avatar, AvatarFallback },
    setup: () => ({ args }),
    template: '<Avatar v-bind="args"><AvatarFallback>AL</AvatarFallback></Avatar>',
  }),
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Small: Story = { args: { size: 'sm' } };
export const Large: Story = { args: { size: 'lg' } };
export const WithBadge: Story = {
  render: () => ({
    components: { Avatar, AvatarFallback, AvatarBadge },
    template: '<Avatar><AvatarFallback>AL</AvatarFallback><AvatarBadge /></Avatar>',
  }),
};
export const Group: Story = {
  render: () => ({
    components: { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount },
    template: `<AvatarGroup>
      <Avatar><AvatarFallback>AL</AvatarFallback></Avatar>
      <Avatar><AvatarFallback>GH</AvatarFallback></Avatar>
      <AvatarGroupCount>+3</AvatarGroupCount>
    </AvatarGroup>`,
  }),
};
