import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '.';

type Side = 'top' | 'right' | 'bottom' | 'left';

const meta = {
  title: 'UI/Sheet',
  component: Sheet,
  args: { defaultOpen: false },
  render: (args) => ({
    components: {
      Sheet,
      SheetClose,
      SheetContent,
      SheetDescription,
      SheetFooter,
      SheetHeader,
      SheetTitle,
      SheetTrigger,
      Button,
    },
    setup: () => ({ args, side: ((args as { side?: Side }).side ?? 'right') as Side }),
    template: `<Sheet v-bind="args">
      <SheetTrigger as-child><Button variant="outline">Open sheet</Button></SheetTrigger>
      <SheetContent :side="side">
        <SheetHeader>
          <SheetTitle>Navigation</SheetTitle>
          <SheetDescription>Move between pages.</SheetDescription>
        </SheetHeader>
        <SheetFooter><SheetClose as-child><Button variant="outline">Close</Button></SheetClose></SheetFooter>
      </SheetContent>
    </Sheet>`,
  }),
} satisfies Meta<typeof Sheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const OpenRight: Story = { args: { defaultOpen: true } };
export const OpenLeft: Story = { args: { defaultOpen: true, side: 'left' } as Story['args'] };
export const OpenTop: Story = { args: { defaultOpen: true, side: 'top' } as Story['args'] };
export const OpenBottom: Story = { args: { defaultOpen: true, side: 'bottom' } as Story['args'] };
