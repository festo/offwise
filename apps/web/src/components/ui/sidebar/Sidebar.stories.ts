import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { House, Users } from '@lucide/vue';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from '.';

type Variant = 'sidebar' | 'floating' | 'inset';
type Collapsible = 'offcanvas' | 'icon' | 'none';

const meta = {
  title: 'UI/Sidebar',
  component: Sidebar,
  args: { side: 'left', variant: 'sidebar', collapsible: 'offcanvas' },
  argTypes: {
    side: { control: 'inline-radio', options: ['left', 'right'] },
    variant: {
      control: 'inline-radio',
      options: ['sidebar', 'floating', 'inset'] satisfies Variant[],
    },
    collapsible: {
      control: 'inline-radio',
      options: ['offcanvas', 'icon', 'none'] satisfies Collapsible[],
    },
  },
  parameters: { layout: 'fullscreen' },
  render: (args) => ({
    components: {
      Sidebar,
      SidebarContent,
      SidebarFooter,
      SidebarGroup,
      SidebarGroupContent,
      SidebarGroupLabel,
      SidebarHeader,
      SidebarInset,
      SidebarMenu,
      SidebarMenuBadge,
      SidebarMenuButton,
      SidebarMenuItem,
      SidebarMenuSkeleton,
      SidebarProvider,
      SidebarRail,
      SidebarSeparator,
      SidebarTrigger,
      House,
      Users,
    },
    setup: () => ({ args }),
    template: `<SidebarProvider>
      <Sidebar v-bind="args">
        <SidebarHeader><span class="px-2 font-semibold">offwise</span></SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton is-active tooltip="Home"><House /><span>Home</span></SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Users"><Users /><span>Users</span></SidebarMenuButton>
                  <SidebarMenuBadge>12</SidebarMenuBadge>
                </SidebarMenuItem>
                <SidebarMenuItem><SidebarMenuSkeleton show-icon /></SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter><span class="px-2 text-xs text-muted-foreground">v0.0.0</span></SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header class="flex h-14 items-center gap-2 border-b px-4"><SidebarTrigger /><span>Page</span></header>
        <div class="p-4">Content</div>
      </SidebarInset>
    </SidebarProvider>`,
  }),
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Floating: Story = { args: { variant: 'floating' } };
export const Inset: Story = { args: { variant: 'inset' } };
export const CollapsibleIcon: Story = { args: { collapsible: 'icon' } };
export const NotCollapsible: Story = { args: { collapsible: 'none' } };
export const Right: Story = { args: { side: 'right' } };
export const Mobile: Story = { globals: { viewport: { value: 'mobile', isRotated: false } } };
