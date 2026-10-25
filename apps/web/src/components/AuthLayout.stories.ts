import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthLayout from './AuthLayout.vue';

const meta = {
  title: 'Layout/AuthLayout',
  component: AuthLayout,
  parameters: { layout: 'fullscreen' },
  args: { title: 'Sign in', description: 'Use your work email and password.' },
  render: (args) => ({
    components: { AuthLayout, Button, Input, Label },
    setup: () => ({ args }),
    template: `<AuthLayout v-bind="args">
      <form class="grid gap-4" @submit.prevent>
        <div class="grid gap-2"><Label for="story-email">Email</Label><Input id="story-email" type="email" /></div>
        <Button type="submit" class="h-11 w-full">Sign in</Button>
      </form>
      <template #footer><a href="#" class="underline">Forgot your password?</a></template>
    </AuthLayout>`,
  }),
} satisfies Meta<typeof AuthLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Mobile: Story = {
  globals: { viewport: { value: 'mobile', isRotated: false } },
};
