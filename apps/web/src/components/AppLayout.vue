<script setup lang="ts">
import type { CurrentUser } from '@offwise/shared';
import type { Component } from 'vue';
import { House, Users } from '@lucide/vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRoute } from 'vue-router';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import UserMenu from './UserMenu.vue';

const props = defineProps<{ user: CurrentUser }>();
const emit = defineEmits<{ signOut: [] }>();

const { t } = useI18n();
const route = useRoute();

interface NavItem {
  to: string;
  label: string;
  icon: Component;
}

const navItems = computed<NavItem[]>(() => [
  { to: '/', label: t('layout.home'), icon: House },
  ...(props.user.role === 'admin'
    ? [{ to: '/admin/users', label: t('layout.users'), icon: Users }]
    : []),
]);

const isActive = (to: string) =>
  to === '/' ? route.path === '/' : route.path === to || route.path.startsWith(`${to}/`);
</script>

<template>
  <SidebarProvider>
    <Sidebar :mobile-title="t('layout.navTitle')" :mobile-description="t('layout.navDescription')">
      <SidebarHeader class="h-14 justify-center px-4">
        <span class="text-lg font-semibold">{{ t('app.name') }}</span>
      </SidebarHeader>
      <SidebarContent>
        <nav :aria-label="t('layout.navLabel')">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem v-for="item in navItems" :key="item.to">
                  <SidebarMenuButton as-child :is-active="isActive(item.to)" class="h-11 md:h-8">
                    <RouterLink
                      :to="item.to"
                      :aria-current="isActive(item.to) ? 'page' : undefined"
                    >
                      <component :is="item.icon" aria-hidden="true" />
                      <span>{{ item.label }}</span>
                    </RouterLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </nav>
      </SidebarContent>
    </Sidebar>
    <div class="flex min-w-0 flex-1 flex-col bg-background">
      <header
        class="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background px-2 md:px-4"
      >
        <SidebarTrigger class="size-11 md:hidden" :label="t('layout.toggleNav')" />
        <span class="font-semibold md:hidden">{{ t('app.name') }}</span>
        <div class="ml-auto">
          <UserMenu :user="user" @sign-out="emit('signOut')" />
        </div>
      </header>
      <main class="flex-1 p-4 md:p-6">
        <slot />
      </main>
    </div>
  </SidebarProvider>
</template>
