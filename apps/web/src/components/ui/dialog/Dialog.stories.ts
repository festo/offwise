import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '.';

const meta = {
  title: 'UI/Dialog',
  component: Dialog,
  args: { defaultOpen: false },
  render: (args) => ({
    components: {
      Dialog,
      DialogClose,
      DialogContent,
      DialogDescription,
      DialogFooter,
      DialogHeader,
      DialogTitle,
      DialogTrigger,
      Button,
    },
    setup: () => ({ args }),
    template: `<Dialog v-bind="args">
      <DialogTrigger as-child><Button variant="outline">Close user</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close this user?</DialogTitle>
          <DialogDescription>They will no longer be able to sign in.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose as-child><Button variant="outline">Cancel</Button></DialogClose>
          <Button variant="destructive">Close user</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>`,
  }),
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Open: Story = { args: { defaultOpen: true } };
