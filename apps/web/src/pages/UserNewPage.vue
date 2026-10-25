<script setup lang="ts">
import type { CreateUserRequest, UpdateUserRequest } from '@offwise/shared';
import { ChevronLeft } from '@lucide/vue';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRouter } from 'vue-router';
import AppLayout from '@/components/AppLayout.vue';
import { useSession } from '@/features/auth/composables/useSession';
import { useSignOut } from '@/features/auth/composables/useSignOut';
import UserForm from '@/features/users/components/UserForm.vue';
import { useUsers } from '@/features/users/composables/useUsers';
import { userFormErrors, type UserFormErrors } from '@/features/users/lib/userFormErrors';

const { t } = useI18n();
const router = useRouter();
const session = useSession();
const signOut = useSignOut();
const { createUser } = useUsers();

const pending = ref(false);
const errors = ref<UserFormErrors | null>(null);

async function onSubmit(body: CreateUserRequest | UpdateUserRequest) {
  pending.value = true;
  errors.value = null;
  try {
    const created = await createUser(body as CreateUserRequest);
    await router.push({ name: 'user-edit', params: { id: created.id }, query: { created: '1' } });
  } catch (e) {
    errors.value = userFormErrors(e, t);
  } finally {
    pending.value = false;
  }
}

function onCancel() {
  void router.push({ name: 'users' });
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
      <h1 class="text-2xl font-semibold text-foreground">{{ t('pages.userNew') }}</h1>
      <UserForm
        mode="create"
        :pending="pending"
        :errors="errors"
        @submit="onSubmit"
        @cancel="onCancel"
      />
    </div>
  </AppLayout>
</template>
