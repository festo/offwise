import type { UserDto } from '@offwise/shared';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';
import UserTable from './UserTable.vue';

const base: UserDto = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  role: 'admin',
  locale: null,
  timeZone: null,
  hasPassword: true,
  createdAt: '2026-10-01T09:00:00.000Z',
  closedAt: null,
};

const users: UserDto[] = [
  base,
  {
    ...base,
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Alan Turing',
    email: 'alan@example.com',
    role: 'manager',
  },
  {
    ...base,
    id: '00000000-0000-0000-0000-000000000003',
    name: 'Grace Hopper',
    email: 'grace.brewster.murray.hopper@example.com',
    role: 'employee',
    hasPassword: false,
  },
  {
    ...base,
    id: '00000000-0000-0000-0000-000000000004',
    name: 'Katherine Johnson',
    email: 'katherine@example.com',
    role: 'auditor',
  },
];

const closed: UserDto = {
  ...base,
  id: '00000000-0000-0000-0000-000000000005',
  name: 'Charles Babbage',
  email: 'charles@example.com',
  role: 'employee',
  closedAt: '2026-10-10T09:00:00.000Z',
};

const meta = {
  title: 'Users/UserTable',
  component: UserTable,
  parameters: { layout: 'padded' },
  args: { users, total: 60, page: 1, pageSize: 25, onSelect: fn(), onPage: fn() },
} satisfies Meta<typeof UserTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Loading: Story = { args: { users: [], loading: true } };
export const Empty: Story = { args: { users: [], total: 0 } };
export const WithClosed: Story = { args: { users: [...users, closed], total: 5, page: 1 } };
export const MiddlePage: Story = { args: { page: 2 } };
export const Mobile: Story = {
  args: { users: [...users, closed] },
  globals: { viewport: { value: 'mobile', isRotated: false } },
};
