import type { Meta, StoryObj } from '@storybook/vue3-vite';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '.';

const meta = {
  title: 'UI/Select',
  component: Select,
  args: { defaultOpen: false, disabled: false },
  render: (args) => ({
    components: {
      Select,
      SelectContent,
      SelectGroup,
      SelectItem,
      SelectLabel,
      SelectSeparator,
      SelectTrigger,
      SelectValue,
    },
    setup: () => ({ args }),
    template: `<Select v-bind="args">
      <SelectTrigger class="w-56" aria-label="Role"><SelectValue placeholder="Choose a role" /></SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Roles</SelectLabel>
          <SelectItem value="employee">Employee</SelectItem>
          <SelectItem value="manager">Manager</SelectItem>
          <SelectSeparator />
          <SelectItem value="admin">Admin</SelectItem>
          <SelectItem value="auditor" disabled>Auditor</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>`,
  }),
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Selected: Story = { args: { defaultValue: 'manager' } };
export const Open: Story = { args: { defaultOpen: true } };
export const Disabled: Story = { args: { disabled: true } };
