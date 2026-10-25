<script setup lang="ts">
import type { UserDto } from '@offwise/shared';
import { ChevronLeft, ChevronRight } from '@lucide/vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const props = defineProps<{
  users: UserDto[];
  loading?: boolean;
  total: number;
  page: number;
  pageSize: number;
}>();
const emit = defineEmits<{ select: [id: string]; page: [page: number] }>();

const { t } = useI18n();

const pages = computed(() => Math.max(1, Math.ceil(props.total / Math.max(1, props.pageSize))));
const empty = computed(() => !props.loading && props.users.length === 0);
const skeletonRows = 3;

// The name link is the row's accessible, keyboard-operable target; a click elsewhere on the row
// is a mouse shortcut. Clicks on the link navigate by themselves, so they are not re-emitted.
function onRowClick(event: MouseEvent, id: string) {
  if (event.target instanceof Element && event.target.closest('a')) return;
  emit('select', id);
}
</script>

<template>
  <div class="grid gap-4" :aria-busy="loading ? 'true' : undefined">
    <!-- Phones: stacked cards -->
    <div class="md:hidden">
      <ul v-if="loading" class="grid gap-2" :aria-label="t('users.loading')">
        <li v-for="n in skeletonRows" :key="n" class="rounded-lg border p-4">
          <Skeleton class="h-4 w-1/2" />
          <Skeleton class="mt-2 h-4 w-3/4" />
        </li>
      </ul>
      <p v-else-if="empty" class="rounded-lg border p-6 text-center text-muted-foreground">
        {{ t('users.empty') }}
      </p>
      <ul v-else class="grid gap-2">
        <li v-for="user in users" :key="user.id">
          <button
            type="button"
            class="grid min-h-11 w-full gap-1 rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            @click="emit('select', user.id)"
          >
            <span class="font-medium break-words">{{ user.name }}</span>
            <span class="text-sm break-all text-muted-foreground">{{ user.email }}</span>
            <span class="flex flex-wrap items-center gap-2 text-sm">
              <span>{{ t(`users.roles.${user.role}`) }}</span>
              <Badge v-if="user.closedAt" variant="secondary">{{ t('users.closed') }}</Badge>
              <Badge v-if="!user.hasPassword" variant="outline">
                {{ t('users.passwordNotSet') }}
              </Badge>
            </span>
          </button>
        </li>
      </ul>
    </div>

    <!-- From md: a table -->
    <div class="hidden md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{{ t('users.columns.name') }}</TableHead>
            <TableHead>{{ t('users.columns.email') }}</TableHead>
            <TableHead>{{ t('users.columns.role') }}</TableHead>
            <TableHead>{{ t('users.columns.status') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="loading">
            <TableRow v-for="n in skeletonRows" :key="n">
              <TableCell v-for="c in 4" :key="c"><Skeleton class="h-4 w-24" /></TableCell>
            </TableRow>
          </template>
          <TableRow v-else-if="empty">
            <TableCell colspan="4" class="h-24 text-center text-muted-foreground">
              {{ t('users.empty') }}
            </TableCell>
          </TableRow>
          <template v-else>
            <TableRow
              v-for="user in users"
              :key="user.id"
              class="cursor-pointer has-focus-visible:bg-muted/50"
              @click="onRowClick($event, user.id)"
            >
              <TableCell class="font-medium">
                <RouterLink
                  :to="{ name: 'user-edit', params: { id: user.id } }"
                  class="rounded-sm underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {{ user.name }}
                </RouterLink>
              </TableCell>
              <TableCell>{{ user.email }}</TableCell>
              <TableCell>{{ t(`users.roles.${user.role}`) }}</TableCell>
              <TableCell>
                <span class="flex flex-wrap items-center gap-2">
                  <Badge v-if="user.closedAt" variant="secondary">{{ t('users.closed') }}</Badge>
                  <Badge v-if="!user.hasPassword" variant="outline">
                    {{ t('users.passwordNotSet') }}
                  </Badge>
                </span>
              </TableCell>
            </TableRow>
          </template>
        </TableBody>
      </Table>
    </div>

    <nav
      v-if="total > 0"
      class="flex items-center justify-between gap-2"
      :aria-label="t('users.pagination')"
    >
      <Button
        variant="outline"
        class="h-11 min-w-11 md:h-9 md:min-w-9"
        :disabled="loading || page <= 1"
        :aria-label="t('users.previousPage')"
        @click="emit('page', page - 1)"
      >
        <ChevronLeft aria-hidden="true" />
        <span class="hidden sm:inline">{{ t('users.previous') }}</span>
      </Button>
      <span class="text-sm text-muted-foreground" aria-live="polite">
        {{ t('users.pageOf', { page, pages }) }}
      </span>
      <Button
        variant="outline"
        class="h-11 min-w-11 md:h-9 md:min-w-9"
        :disabled="loading || page >= pages"
        :aria-label="t('users.nextPage')"
        @click="emit('page', page + 1)"
      >
        <span class="hidden sm:inline">{{ t('users.next') }}</span>
        <ChevronRight aria-hidden="true" />
      </Button>
    </nav>
  </div>
</template>
