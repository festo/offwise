<script setup lang="ts">
import type { CurrentUser } from '@offwise/shared';
import { LogOut } from '@lucide/vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const props = defineProps<{ user: CurrentUser }>();
const emit = defineEmits<{ signOut: [] }>();

const { t } = useI18n();

const initials = computed(() => {
  const words = props.user.name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
});
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        variant="ghost"
        class="h-11 min-w-11 gap-2 px-1.5"
        :aria-label="t('userMenu.trigger', { name: user.name })"
      >
        <Avatar>
          <AvatarFallback>{{ initials }}</AvatarFallback>
        </Avatar>
        <span class="hidden max-w-40 truncate sm:inline">{{ user.name }}</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-64 max-w-[calc(100vw-2rem)]">
      <DropdownMenuLabel class="flex flex-col gap-0.5 font-normal">
        <span class="truncate font-medium text-foreground">{{ user.name }}</span>
        <span class="truncate text-xs text-muted-foreground">{{ user.email }}</span>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem class="min-h-11 md:min-h-8" @select="emit('signOut')">
        <LogOut aria-hidden="true" />
        <span>{{ t('userMenu.signOut') }}</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
