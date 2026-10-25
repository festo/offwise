import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '.';

const meta = {
  title: 'UI/Tooltip',
  component: Tooltip,
  args: { defaultOpen: false },
  render: (args) => ({
    components: { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, Button },
    setup: () => ({ args }),
    template: `<TooltipProvider>
      <Tooltip v-bind="args">
        <TooltipTrigger as-child><Button variant="outline">Hover or focus</Button></TooltipTrigger>
        <TooltipContent>Approved by your manager</TooltipContent>
      </Tooltip>
    </TooltipProvider>`,
  }),
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Open: Story = { args: { defaultOpen: true } };
