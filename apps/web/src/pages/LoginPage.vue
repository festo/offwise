<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import AuthLayout from '@/components/AuthLayout.vue';
import LoginForm from '@/features/auth/components/LoginForm.vue';
import { useSession } from '@/features/auth/composables/useSession';
import { tooManyAttemptsMessage } from '@/features/auth/lib/tooManyAttempts';
import { ApiError } from '@/lib/api';
import { safeRedirect } from '@/router/guards';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const session = useSession();

const pending = ref(false);
const error = ref<string | null>(null);

async function onSubmit({ email, password }: { email: string; password: string }) {
  pending.value = true;
  error.value = null;
  try {
    await session.login(email, password);
    await router.replace(safeRedirect(route.query.redirect));
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) error.value = t('auth.invalidCredentials');
    else if (e instanceof ApiError && e.status === 429)
      error.value = tooManyAttemptsMessage(t, e.retryAfter);
    else error.value = t('auth.genericError');
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <AuthLayout :title="t('pages.login')" :description="t('auth.loginDescription')">
    <p v-if="route.query.reset === '1'" role="status" class="mb-4 text-sm">
      {{ t('auth.resetDone') }}
    </p>
    <LoginForm :pending="pending" :error="error" @submit="onSubmit" />
  </AuthLayout>
</template>
