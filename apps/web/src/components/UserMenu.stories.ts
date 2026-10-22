import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';
import UserMenu from './UserMenu.vue';

const meta = {
  title: 'Layout/UserMenu',
  component: UserMenu,
  args: {
    user: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Grace Hopper',
      email: 'grace@example.com',
      role: 'employee',
      locale: 'en-GB',
      timeZone: 'UTC',
    },
    onSignOut: fn(),
  },
} satisfies Meta<typeof UserMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
