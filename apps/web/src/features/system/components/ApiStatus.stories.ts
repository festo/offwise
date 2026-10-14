import type { Meta, StoryObj } from '@storybook/vue3-vite';
import ApiStatus from './ApiStatus.vue';

const meta = {
  title: 'System/ApiStatus',
  component: ApiStatus,
  args: { state: 'ok' },
} satisfies Meta<typeof ApiStatus>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Connected: Story = { args: { state: 'ok' } };
export const Loading: Story = { args: { state: 'loading' } };
export const Unavailable: Story = { args: { state: 'error' } };
