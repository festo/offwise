<script setup lang="ts">
import { DEFAULT_PAGE_SIZE } from '@offwise/shared';
import { Plus, Search } from '@lucide/vue';
import { watchDebounced } from '@vueuse/core';
import { computed, ref, useId, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRoute, useRouter, type LocationQueryRaw } from 'vue-router';
import AppLayout from '@/components/AppLayout.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useSession } from '@/features/auth/composables/useSession';
import { useSignOut } from '@/features/auth/composables/useSignOut';
import UserTable from '@/features/users/components/UserTable.vue';
import { useUsers, type UsersQuery } from '@/features/users/composables/useUsers';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const session = useSession();
const signOut = useSignOut();
const users = useUsers();

const searchId = useId();
const closedId = useId();
const search = ref('');

// The URL is the source of truth for the list query, so reloads and back/forward keep it.
function readQuery(): void {
  const { search: s, includeClosed, page } = route.query;
  users.query.search = typeof s === 'string' ? s : '';
  users.query.includeClosed = includeClosed === 'true';
  const n = Number(page);
  users.query.page = Number.isInteger(n) && n >= 1 ? n : 1;
  // Only overwrite the input when it disagrees with the URL, so a trailing space or text typed
  // within the debounce window survives a query change.
  if (search.value.trim() !== users.query.search) search.value = users.query.search;
}

watch(
  () => route.query,
  () => {
    // Leaving for another route changes the query before this page unmounts; ignore that.
    if (route.name !== 'users') return;
    readQuery();
    void users.fetch();
  },
  { immediate: true },
);

/** Navigates to the list query; the search defaults to what is typed, even if not yet debounced. */
function navigate(change: Partial<UsersQuery>): void {
  const next = { ...users.query, search: search.value, ...change };
  const query: LocationQueryRaw = {};
  const s = next.search.trim();
  // A different search starts on page 1, so a pager click never pages through a stale result.
  if (s !== users.query.search) next.page = 1;
  if (s) query.search = s;
  if (next.includeClosed) query.includeClosed = 'true';
  if (next.page > 1) query.page = String(next.page);
  void router.replace({ query });
}

watchDebounced(
  search,
  (value) => {
    if (value.trim() === users.query.search.trim()) return;
    navigate({ search: value, page: 1 });
  },
  { debounce: 300 },
);

const result = computed(() => users.page.value);

// A `?page=` past the end (bookmark, closed users) moves to the last page once the result is in.
watch([result, users.loading], ([current, loading]) => {
  if (!current || loading) return;
  const lastPage = Math.max(1, Math.ceil(current.total / current.pageSize));
  if (users.query.page > lastPage) navigate({ search: users.query.search, page: lastPage });
});

function openUser(id: string): void {
  void router.push({ name: 'user-edit', params: { id } });
}
</script>

<template>
  <AppLayout v-if="session.user.value" :user="session.user.value" @sign-out="signOut">
    <div class="mx-auto flex max-w-5xl flex-col gap-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h1 class="text-2xl font-semibold text-foreground">{{ t('pages.users') }}</h1>
        <Button as-child class="h-11 md:h-9">
          <RouterLink :to="{ name: 'user-new' }">
            <Plus aria-hidden="true" />
            {{ t('users.addUser') }}
          </RouterLink>
        </Button>
      </div>

      <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div class="grid gap-2 md:w-80">
          <Label :for="searchId">{{ t('users.search') }}</Label>
          <div class="relative">
            <Search
              class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              :id="searchId"
              v-model="search"
              type="search"
              name="search"
              autocomplete="off"
              :placeholder="t('users.searchPlaceholder')"
              class="h-11 pl-9 text-base md:h-9 md:text-sm"
            />
          </div>
        </div>
        <div class="flex min-h-11 items-center gap-3">
          <Switch
            :id="closedId"
            :model-value="users.query.includeClosed"
            @update:model-value="(value: boolean) => navigate({ includeClosed: value, page: 1 })"
          />
          <!-- The label is the 44 px tap target; the 18 px switch alone is too small. -->
          <Label :for="closedId" class="inline-flex min-h-11 cursor-pointer items-center pr-2">
            {{ t('users.showClosed') }}
          </Label>
        </div>
      </div>

      <div
        v-if="users.error.value"
        role="alert"
        class="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between"
      >
        <span>{{ t('users.loadError') }}</span>
        <Button variant="outline" class="h-11 sm:h-9" @click="users.fetch()">
          {{ t('users.retry') }}
        </Button>
      </div>

      <UserTable
        v-else
        :users="result?.items ?? []"
        :loading="users.loading.value"
        :total="result?.total ?? 0"
        :page="users.query.page"
        :page-size="result?.pageSize ?? DEFAULT_PAGE_SIZE"
        @select="openUser"
        @page="(page) => navigate({ page })"
      />
    </div>
  </AppLayout>
</template>
