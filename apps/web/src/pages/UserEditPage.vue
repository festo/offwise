<script setup lang="ts">
import { LAST_ADMIN_RULE, type UpdateUserRequest, type UserDto } from '@offwise/shared';
import { ChevronLeft } from '@lucide/vue';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import AppLayout from '@/components/AppLayout.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/features/auth/composables/useSession';
import { useSignOut } from '@/features/auth/composables/useSignOut';
import CloseUserDialog from '@/features/users/components/CloseUserDialog.vue';
import UserForm from '@/features/users/components/UserForm.vue';
import { useUsers } from '@/features/users/composables/useUsers';
import { userFormErrors, type UserFormErrors } from '@/features/users/lib/userFormErrors';
import { ApiError } from '@/lib/api';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const session = useSession();
const signOut = useSignOut();
const { getUser, updateUser, closeUser } = useUsers();

const id = computed(() => String(route.params.id));
const user = ref<UserDto | null>(null);
const state = ref<'loading' | 'ready' | 'notFound' | 'error'>('loading');

// Switching users quickly can resolve requests out of order; only the latest one may land.
let latest = 0;

async function load(): Promise<void> {
  const request = ++latest;
  state.value = 'loading';
  try {
    const result = await getUser(id.value);
    if (request !== latest) return;
    user.value = result;
    state.value = 'ready';
  } catch (e) {
    if (request !== latest) return;
    state.value = e instanceof ApiError && e.status === 404 ? 'notFound' : 'error';
  }
}
watch(id, load, { immediate: true });

const saving = ref(false);
const saved = ref(false);
const formErrors = ref<UserFormErrors | null>(null);

const note = computed(() => {
  if (saved.value) return t('users.saved');
  if (route.query.created === '1') return t('users.created');
  return null;
});

async function onSubmit(body: UpdateUserRequest): Promise<void> {
  saving.value = true;
  saved.value = false;
  formErrors.value = null;
  try {
    user.value = await updateUser(id.value, body);
    saved.value = true;
  } catch (e) {
    formErrors.value = userFormErrors(e, t);
  } finally {
    saving.value = false;
  }
}

const closeOpen = ref(false);
const closing = ref(false);
const closeError = ref<string | null>(null);

function openClose(): void {
  closeError.value = null;
  closeOpen.value = true;
}

async function onConfirmClose(): Promise<void> {
  closing.value = true;
  closeError.value = null;
  try {
    await closeUser(id.value);
    closeOpen.value = false;
    await router.push({ name: 'users' });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      // Closed (or removed) elsewhere meanwhile: show the user as it is now.
      closeOpen.value = false;
      await load();
      return;
    }
    closeError.value =
      e instanceof ApiError && e.status === 409 && e.rule === LAST_ADMIN_RULE
        ? t('users.close.lastAdmin')
        : t('auth.genericError');
  } finally {
    closing.value = false;
  }
}
</script>

<template>
  <AppLayout v-if="session.user.value" :user="session.user.value" @sign-out="signOut">
    <div class="mx-auto flex max-w-xl flex-col gap-4">
      <RouterLink
        :to="{ name: 'users' }"
        class="inline-flex min-h-11 items-center gap-1 self-start text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        <ChevronLeft class="size-4" aria-hidden="true" />
        {{ t('users.backToList') }}
      </RouterLink>

      <template v-if="state === 'loading'">
        <h1 class="sr-only">{{ t('pages.userEdit') }}</h1>
        <div class="grid gap-4" aria-busy="true">
          <Skeleton class="h-8 w-48" />
          <Skeleton v-for="n in 4" :key="n" class="h-11 w-full" />
        </div>
      </template>

      <template v-else-if="state === 'notFound' || state === 'error'">
        <h1 class="text-2xl font-semibold text-foreground">{{ t('pages.userEdit') }}</h1>
        <div
          class="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between"
        >
          <p role="alert">
            {{ state === 'notFound' ? t('users.notFound') : t('users.loadUserError') }}
          </p>
          <Button v-if="state === 'error'" variant="outline" class="h-11 sm:h-9" @click="load">
            {{ t('users.retry') }}
          </Button>
        </div>
      </template>

      <template v-else-if="user">
        <div class="flex flex-col gap-1">
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="text-2xl font-semibold break-words text-foreground">{{ user.name }}</h1>
            <Badge v-if="user.closedAt" variant="secondary">{{ t('users.closed') }}</Badge>
          </div>
          <p class="text-sm break-all text-muted-foreground">{{ user.email }}</p>
        </div>
        <p v-if="user.closedAt" class="text-sm text-muted-foreground">
          {{ t('users.closedNote') }}
        </p>
        <p v-if="note" role="status" class="text-sm">{{ note }}</p>

        <UserForm
          mode="edit"
          :initial="user"
          :pending="saving"
          :errors="formErrors"
          @submit="onSubmit"
          @cancel="router.push({ name: 'users' })"
        />

        <template v-if="!user.closedAt">
          <Separator />
          <div>
            <Button variant="destructive" class="h-11 w-full sm:h-9 sm:w-auto" @click="openClose">
              {{ t('users.close.button') }}
            </Button>
          </div>
          <CloseUserDialog
            v-model:open="closeOpen"
            :user="user"
            :pending="closing"
            :error="closeError"
            @confirm="onConfirmClose"
          />
        </template>
      </template>
    </div>
  </AppLayout>
</template>
