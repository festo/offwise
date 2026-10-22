import type { Meta, StoryObj } from '@storybook/vue3-vite';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '.';

const components = {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
};
const rows = [
  { name: 'Ada Lovelace', email: 'ada@example.com', role: 'admin' },
  { name: 'Grace Hopper', email: 'grace@example.com', role: 'employee' },
];

const meta = {
  title: 'UI/Table',
  component: Table,
  render: () => ({
    components,
    setup: () => ({ rows }),
    template: `<Table>
      <TableCaption>Users</TableCaption>
      <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead></TableRow></TableHeader>
      <TableBody>
        <TableRow v-for="row in rows" :key="row.email">
          <TableCell>{{ row.name }}</TableCell><TableCell>{{ row.email }}</TableCell><TableCell>{{ row.role }}</TableCell>
        </TableRow>
      </TableBody>
    </Table>`,
  }),
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = {
  render: () => ({
    components,
    template: `<Table>
      <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead></TableRow></TableHeader>
      <TableBody><TableEmpty :colspan="3">No users found.</TableEmpty></TableBody>
    </Table>`,
  }),
};
