import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '.';

const meta = {
  title: 'UI/Card',
  component: Card,
  args: { size: 'default' },
  render: (args) => ({
    components: {
      Card,
      CardAction,
      CardContent,
      CardDescription,
      CardFooter,
      CardHeader,
      CardTitle,
      Button,
    },
    setup: () => ({ args }),
    template: `<Card v-bind="args" class="w-80">
      <CardHeader>
        <CardTitle>Annual leave</CardTitle>
        <CardDescription>Requests for the coming months.</CardDescription>
        <CardAction><Button variant="link" size="sm">View</Button></CardAction>
      </CardHeader>
      <CardContent><p>No pending requests.</p></CardContent>
      <CardFooter><Button class="w-full">New request</Button></CardFooter>
    </Card>`,
  }),
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Small: Story = { args: { size: 'sm' } };
